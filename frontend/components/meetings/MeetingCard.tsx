"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Meeting } from "@/lib/types";
import Link from "next/link";
import { format } from "date-fns";
import { retryTranscription, retryExtraction, getMeetingStatus } from "@/lib/api";

interface MeetingCardProps {
  meeting: Meeting;
  dealId: string;
  onRetryComplete?: () => void;
}

const statusColors: Record<Meeting["processing_status"], string> = {
  pending: "bg-gray-200 text-gray-800",
  transcribing: "bg-blue-200 text-blue-800",
  extracting: "bg-indigo-200 text-indigo-800",
  storing_memory: "bg-purple-200 text-purple-800",
  complete: "bg-green-200 text-green-800",
  failed: "bg-red-200 text-red-800",
};

export default function MeetingCard({ meeting, dealId, onRetryComplete }: MeetingCardProps) {
  const [retrying, setRetrying] = useState(false);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);

  const formattedDate = format(new Date(meeting.meeting_date), "PPP p");
  const title = meeting.title ?? `Meeting #${meeting.meeting_number ?? ""}`;

  const hasTranscript = meeting.processing_status === "failed" && meeting.processing_error?.includes("extraction");
  const hasAudio = meeting.processing_status === "failed" && meeting.processing_error?.includes("Transcription");

  const handleRetryTranscription = async () => {
    setRetrying(true);
    setRetryStatus("Starting retry...");
    try {
      await retryTranscription(meeting.id);
      // Poll for completion
      const pollInterval = setInterval(async () => {
        const status = await getMeetingStatus(meeting.id);
        setRetryStatus(status.step_message);
        if (status.status === "complete" || status.status === "failed") {
          clearInterval(pollInterval);
          setRetrying(false);
          onRetryComplete?.();
        }
      }, 3000);
    } catch (err) {
      setRetryStatus(err instanceof Error ? err.message : "Retry failed");
      setRetrying(false);
    }
  };

  const handleRetryExtraction = async () => {
    setRetrying(true);
    setRetryStatus("Starting extraction retry...");
    try {
      await retryExtraction(meeting.id);
      // Poll for completion
      const pollInterval = setInterval(async () => {
        const status = await getMeetingStatus(meeting.id);
        setRetryStatus(status.step_message);
        if (status.status === "complete" || status.status === "failed") {
          clearInterval(pollInterval);
          setRetrying(false);
          onRetryComplete?.();
        }
      }, 3000);
    } catch (err) {
      setRetryStatus(err instanceof Error ? err.message : "Retry failed");
      setRetrying(false);
    }
  };

  const content = (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-medium">{title}</CardTitle>
        <Badge className={statusColors[meeting.processing_status]}>
          {meeting.processing_status.replace("_", " ")}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-gray-600">{formattedDate}</p>
        
        {meeting.processing_error && (
          <p className="text-xs text-red-600 truncate" title={meeting.processing_error}>
            {meeting.processing_error}
          </p>
        )}

        {meeting.processing_status === "failed" && (
          <div className="flex gap-2 flex-wrap">
            {meeting.processing_error?.includes("Transcription") && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleRetryTranscription}
                disabled={retrying}
              >
                {retrying ? "Retrying..." : "Retry Transcription"}
              </Button>
            )}
            {meeting.processing_error?.includes("extraction") && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleRetryExtraction}
                disabled={retrying}
              >
                {retrying ? "Retrying..." : "Retry Extraction"}
              </Button>
            )}
          </div>
        )}

        {retryStatus && (
          <p className="text-xs text-blue-600">{retryStatus}</p>
        )}
      </CardContent>
    </Card>
  );

  if (meeting.processing_status === "complete") {
    return (
      <Link href={`/deals/${dealId}/meeting/${meeting.id}`}>
        {content}
      </Link>
    );
  }
  return content;
}
