"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { createMeeting, uploadAudio, getMeetingStatus } from "@/lib/api";
import { ProcessingStatus } from "@/lib/types";
import { Mic, Square, CheckCircle, AlertCircle } from "lucide-react";

interface Props {
  dealId: string;
  onMeetingComplete: (meetingId: string) => void;
}

type State = "idle" | "naming" | "recording" | "uploading" | "processing" | "done" | "error";

const STEPS = ["transcribing", "extracting", "storing_memory", "complete"] as const;
const STEP_LABELS: Record<string, string> = {
  transcribing: "Transcribing audio",
  extracting: "Extracting intelligence",
  storing_memory: "Updating memory",
  complete: "Complete",
};
const STEP_PROGRESS: Record<string, number> = {
  transcribing: 20, extracting: 50, storing_memory: 80, complete: 100,
};

export default function MeetingRecorder({ dealId, onMeetingComplete }: Props) {
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [meetingTitle, setMeetingTitle] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    setMeetingTitle("");
    setState("naming");
  }, []);

  const beginRecording = useCallback(async () => {
    setErrorMsg(null);
    try {
      const title = meetingTitle.trim() || `Meeting — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      const meeting = await createMeeting(dealId, { title });
      setMeetingId(meeting.id);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(1000);
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err: any) {
      setErrorMsg(err.name === "NotAllowedError"
        ? "Microphone access denied. Please allow microphone permission and try again."
        : `Could not start recording: ${err.message}`);
      setState("error");
    }
  }, [dealId, meetingTitle]);

  const stopRecording = useCallback(async () => {
    if (!recorderRef.current || !meetingId) return;
    if (timerRef.current) clearInterval(timerRef.current);

    await new Promise<void>((resolve) => {
      recorderRef.current!.onstop = () => resolve();
      recorderRef.current!.stop();
      recorderRef.current!.stream.getTracks().forEach((t) => t.stop());
    });

    setState("uploading");
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      await uploadAudio(meetingId, blob);
      setState("processing");

      pollRef.current = setInterval(async () => {
        try {
          const status = await getMeetingStatus(meetingId);
          setProcessingStatus(status);
          if (status.status === "complete") {
            clearInterval(pollRef.current!);
            setState("done");
            onMeetingComplete(meetingId);
          } else if (status.status === "failed") {
            clearInterval(pollRef.current!);
            setErrorMsg(status.error || "Processing failed. Check your API keys and try again.");
            setState("error");
          }
        } catch { /* Continue polling */ }
      }, 3000);
    } catch (err: any) {
      setErrorMsg(`Upload failed: ${err.message}`);
      setState("error");
    }
  }, [meetingId, onMeetingComplete]);

  const progress = processingStatus ? (STEP_PROGRESS[processingStatus.status] || 0) : 0;
  const currentStepIndex = STEPS.indexOf(processingStatus?.status as any);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      {state === "idle" && (
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-800 text-sm">Ready to record</p>
            <p className="text-xs text-slate-400 mt-0.5">Start a meeting to capture and analyze the conversation</p>
          </div>
          <Button
            onClick={startRecording}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Mic className="h-4 w-4" /> Start Meeting
          </Button>
        </div>
      )}

      {state === "naming" && (
        <div className="space-y-3">
          <div>
            <p className="font-medium text-slate-800 text-sm">Name this meeting</p>
            <p className="text-xs text-slate-400 mt-0.5">Give it a title, or leave blank for an auto-generated name</p>
          </div>
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            placeholder="e.g. Q4 Budget Review, Demo Follow-up..."
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-slate-300"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") beginRecording();
              if (e.key === "Escape") { setState("idle"); setMeetingTitle(""); }
            }}
          />
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setState("idle"); setMeetingTitle(""); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={beginRecording}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Mic className="h-3.5 w-3.5" /> Start Recording
            </Button>
          </div>
        </div>
      )}

      {state === "recording" && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            <div>
              <p className="font-mono text-xl font-semibold text-slate-900 tabular-nums">{fmt(seconds)}</p>
              <p className="text-xs text-slate-400">Recording in progress</p>
            </div>
          </div>
          <Button onClick={stopRecording} variant="destructive" className="gap-2">
            <Square className="h-4 w-4" /> End Meeting
          </Button>
        </div>
      )}

      {state === "uploading" && (
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-600">Uploading audio…</p>
        </div>
      )}

      {state === "processing" && processingStatus && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">{processingStatus.step_message}</p>
            <span className="text-xs text-slate-400">{progress}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-2">
            {STEPS.map((step, i) => {
              const isDone = i < currentStepIndex;
              const isActive = i === currentStepIndex;
              return (
                <div key={step} className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${isDone ? "bg-emerald-500" : isActive ? "bg-indigo-500 animate-pulse" : "bg-slate-200"}`} />
                    <span className={`text-xs ${isDone ? "text-emerald-600" : isActive ? "text-indigo-600 font-medium" : "text-slate-400"}`}>
                      {STEP_LABELS[step]}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-px ${isDone ? "bg-emerald-200" : "bg-slate-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {state === "done" && (
        <div className="flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-800">Meeting processed successfully</p>
            <p className="text-xs text-slate-400">Intelligence report and memory update complete</p>
          </div>
        </div>
      )}

      {state === "error" && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setState("idle"); setErrorMsg(null); setSeconds(0); }}
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
