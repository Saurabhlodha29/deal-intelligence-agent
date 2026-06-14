"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { createMeeting, uploadAudio, getMeetingStatus } from "@/lib/api";
import { ProcessingStatus } from "@/lib/types";

interface Props {
  dealId: string;
  onMeetingComplete: (meetingId: string) => void;
}

type RecorderState = "idle" | "recording" | "uploading" | "processing" | "done" | "error";

export default function MeetingRecorder({ dealId, onMeetingComplete }: Props) {
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    try {
      // Create meeting record first
      const title = `Meeting — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      const meeting = await createMeeting(dealId, { title });
      setMeetingId(meeting.id);

      // Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(1000); // Collect in 1-second chunks
      setState("recording");
      setSeconds(0);

      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err: any) {
      setErrorMsg(
        err.name === "NotAllowedError"
          ? "Microphone permission denied. Please allow microphone access and try again."
          : `Failed to start recording: ${err.message}`
      );
      setState("error");
    }
  }, [dealId]);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !meetingId) return;

    const recorder = mediaRecorderRef.current;
    if (timerRef.current) clearInterval(timerRef.current);

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
      // Stop all tracks
      recorder.stream.getTracks().forEach((t) => t.stop());
    });

    setState("uploading");

    try {
      const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
      await uploadAudio(meetingId, audioBlob);
      setState("processing");
      startPolling(meetingId);
    } catch (err: any) {
      setErrorMsg(`Upload failed: ${err.message}`);
      setState("error");
    }
  }, [meetingId]);

  const startPolling = (mId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const status = await getMeetingStatus(mId);
        setProcessingStatus(status);
        if (status.status === "complete") {
          clearInterval(pollRef.current!);
          setState("done");
          onMeetingComplete(mId);
        } else if (status.status === "failed") {
          clearInterval(pollRef.current!);
          setErrorMsg(status.error || "Processing failed");
          setState("error");
        }
      } catch {
        // Continue polling on network error
      }
    }, 3000);
  };

  const progressValue =
    processingStatus?.status === "transcribing" ? 25 :
    processingStatus?.status === "extracting" ? 55 :
    processingStatus?.status === "storing_memory" ? 80 :
    processingStatus?.status === "complete" ? 100 : 0;

  return (
    <div className="rounded-lg border p-4 space-y-4">
      {state === "idle" && (
        <Button onClick={startRecording} className="w-full bg-green-600 hover:bg-green-700 text-white">
          🎙️ Start Meeting
        </Button>
      )}

      {state === "recording" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            <span className="font-mono text-lg font-semibold">{formatTime(seconds)}</span>
            <span className="text-sm text-gray-500">Recording in progress</span>
          </div>
          <Button onClick={stopRecording} variant="destructive" className="w-full">
            ⏹ End Meeting
          </Button>
        </div>
      )}

      {state === "uploading" && (
        <div className="text-sm text-gray-600 animate-pulse">Uploading audio…</div>
      )}

      {state === "processing" && processingStatus && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{processingStatus.step_message}</p>
          <Progress value={progressValue} className="h-2" />
          <div className="flex gap-2 flex-wrap">
            {["transcribing", "extracting", "storing_memory", "complete"].map((step) => {
              const current = processingStatus.status;
              const steps = ["transcribing", "extracting", "storing_memory", "complete"];
              const currentIdx = steps.indexOf(current);
              const stepIdx = steps.indexOf(step);
              const isDone = stepIdx < currentIdx;
              const isActive = step === current;
              return (
                <span
                  key={step}
                  className={`text-xs px-2 py-1 rounded-full border ${
                    isDone ? "bg-green-100 text-green-800 border-green-200" :
                    isActive ? "bg-blue-100 text-blue-800 border-blue-200 animate-pulse" :
                    "bg-gray-100 text-gray-400 border-gray-200"
                  }`}
                >
                  {isDone ? "✓ " : isActive ? "⟳ " : ""}{step.replace("_", " ")}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {state === "done" && (
        <div className="text-sm text-green-700 font-medium">
          ✅ Meeting processed. Intelligence report ready.
        </div>
      )}

      {state === "error" && (
        <div className="space-y-2">
          <div className="text-sm text-red-600">{errorMsg}</div>
          <Button variant="outline" size="sm" onClick={() => { setState("idle"); setErrorMsg(null); }}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}