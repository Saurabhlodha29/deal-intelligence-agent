"use client";

import Link from "next/link";
import { Meeting } from "@/lib/types";
import { format } from "date-fns";

interface Props {
  meeting: Meeting;
  dealId: string;
  onRetryComplete?: () => void;
}

const statusConfig: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  complete:       { label: "Complete",       dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
  transcribing:   { label: "Transcribing…",  dot: "bg-blue-400 animate-pulse", text: "text-blue-700", bg: "bg-blue-50" },
  extracting:     { label: "Extracting…",    dot: "bg-indigo-400 animate-pulse", text: "text-indigo-700", bg: "bg-indigo-50" },
  storing_memory: { label: "Updating memory…",dot: "bg-violet-400 animate-pulse", text: "text-violet-700", bg: "bg-violet-50" },
  pending:        { label: "Pending",         dot: "bg-slate-300", text: "text-slate-500", bg: "bg-slate-50" },
  failed:         { label: "Failed",          dot: "bg-red-500", text: "text-red-600", bg: "bg-red-50" },
};

export default function MeetingCard({ meeting, dealId }: Props) {
  const config = statusConfig[meeting.processing_status] || statusConfig.pending;
  const isComplete = meeting.processing_status === "complete";
  const title = meeting.title || `Meeting #${meeting.meeting_number || ""}`;

  const CardContent = (
    <div className={`
      bg-white border border-slate-200 rounded-xl p-4 shadow-sm
      ${isComplete ? "hover:shadow-md hover:border-slate-300 cursor-pointer transition-all duration-200" : ""}
    `}>
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900 text-sm truncate">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {format(new Date(meeting.meeting_date), "MMM d, yyyy · h:mm a")}
          </p>
        </div>
        <div className={`ml-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
          <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
        </div>
      </div>
      {meeting.processing_status === "failed" && meeting.processing_error && (
        <p className="mt-2 text-xs text-red-500 truncate">{meeting.processing_error}</p>
      )}
    </div>
  );

  if (isComplete) {
    return (
      <Link href={`/deals/${dealId}/meeting/${meeting.id}`}>
        {CardContent}
      </Link>
    );
  }
  return CardContent;
}
