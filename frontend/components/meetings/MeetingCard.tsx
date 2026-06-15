"use client";

import { useState } from "react";
import Link from "next/link";
import { Meeting } from "@/lib/types";
import { format } from "date-fns";
import { deleteMeeting } from "@/lib/api";
import { Trash2 } from "lucide-react";

interface Props {
  meeting: Meeting;
  dealId: string;
  onDeleted?: (meetingId: string) => void;
}

const statusConfig: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  complete:       { label: "Complete",         dot: "bg-emerald-500",                  text: "text-emerald-700", bg: "bg-emerald-50" },
  transcribing:   { label: "Transcribing…",    dot: "bg-blue-400 animate-pulse",       text: "text-blue-700",    bg: "bg-blue-50" },
  extracting:     { label: "Extracting…",      dot: "bg-indigo-400 animate-pulse",     text: "text-indigo-700",  bg: "bg-indigo-50" },
  storing_memory: { label: "Updating memory…", dot: "bg-violet-400 animate-pulse",     text: "text-violet-700",  bg: "bg-violet-50" },
  pending:        { label: "Pending",           dot: "bg-slate-300",                    text: "text-slate-500",   bg: "bg-slate-50" },
  failed:         { label: "Failed",            dot: "bg-red-500",                      text: "text-red-600",     bg: "bg-red-50" },
};

export default function MeetingCard({ meeting, dealId, onDeleted }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const config = statusConfig[meeting.processing_status] || statusConfig.pending;
  const isComplete = meeting.processing_status === "complete";
  const title = meeting.title || `Meeting #${meeting.meeting_number ?? ""}`;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    try {
      await deleteMeeting(meeting.id);
      onDeleted?.(meeting.id);
    } catch (err) {
      console.error("Delete failed:", err);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const CardInner = (
    <div className={`
      bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl p-4 shadow-sm
      ${isComplete ? "hover:shadow-md hover:border-slate-300 cursor-pointer" : ""}
      transition-all duration-200 group
    `}>
      <div className="flex items-center gap-3">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 text-sm truncate">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {format(new Date(meeting.meeting_date), "MMM d, yyyy · h:mm a")}
          </p>
          {meeting.processing_status === "failed" && meeting.processing_error && (
            <p className="mt-1 text-xs text-red-500 truncate">{meeting.processing_error}</p>
          )}
        </div>

        {/* Status pill */}
        <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
          <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
        </div>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={`
            shrink-0 p-1.5 rounded-lg transition-all duration-150
            ${confirmDelete
              ? "bg-red-100 text-red-600 hover:bg-red-200"
              : "text-slate-300 hover:text-slate-500 hover:bg-slate-100 opacity-0 group-hover:opacity-100"
            }
          `}
          title={confirmDelete ? "Click again to confirm deletion" : "Delete this meeting"}
        >
          {deleting ? (
            <div className="h-3.5 w-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Confirm delete hint */}
      {confirmDelete && (
        <p className="mt-2 text-xs text-red-500 font-medium">
          Click the trash icon again to confirm deletion
        </p>
      )}
    </div>
  );

  if (isComplete) {
    return (
      <Link href={`/deals/${dealId}/meeting/${meeting.id}`}>
        {CardInner}
      </Link>
    );
  }
  return CardInner;
}
