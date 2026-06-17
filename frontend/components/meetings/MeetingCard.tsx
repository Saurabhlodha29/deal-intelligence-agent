"use client";

import { useState } from "react";
import Link from "next/link";
import { Meeting } from "@/lib/types";
import { format } from "date-fns";
import { deleteMeeting } from "@/lib/api";
import { Trash2, AlertCircle, RotateCw, X } from "lucide-react";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const config = statusConfig[meeting.processing_status] || statusConfig.pending;
  const isComplete = meeting.processing_status === "complete";
  const isFailed = meeting.processing_status === "failed";
  const title = meeting.title || `Meeting #${meeting.meeting_number ?? ""}`;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMeeting(meeting.id);
      onDeleted?.(meeting.id);
    } catch (err) {
      console.error("Delete failed:", err);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const CardInner = (
    <div className={`
      bg-white/80 backdrop-blur-sm border rounded-xl p-4
      ${isFailed ? "border-red-200/80" : "border-slate-200/80"}
      ${isComplete ? "hover:shadow-md hover:border-slate-300/80 cursor-pointer" : ""}
      transition-all duration-200 group
    `}
    style={{
      boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)",
    }}
    >
      <div className="flex items-center gap-3">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900 text-sm truncate">{title}</p>
            {isFailed && (
              <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {format(new Date(meeting.meeting_date), "MMM d, yyyy · h:mm a")}
          </p>
          {isFailed && meeting.processing_error && (
            <p className="mt-1.5 text-xs text-red-500 bg-red-50/80 px-2 py-1 rounded border border-red-100">
              {meeting.processing_error}
            </p>
          )}
        </div>

        {/* Status pill */}
        <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg} border ${isFailed ? "border-red-200" : "border-transparent"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
          <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-1">
          {/* Retry button (placeholder for failed meetings) */}
          {isFailed && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all duration-150"
              title="Retry processing (coming soon)"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
            className={`
              p-1.5 rounded-lg transition-all duration-150
              ${isFailed
                ? "text-red-400 hover:text-red-600 hover:bg-red-50 opacity-100"
                : "text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100"
              }
            `}
            title="Delete this meeting"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {isComplete ? (
        <Link href={`/deals/${dealId}/meeting/${meeting.id}`}>
          {CardInner}
        </Link>
      ) : (
        CardInner
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          />
          <div className="relative bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full p-5">
            <button
              onClick={() => !deleting && setShowDeleteConfirm(false)}
              className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-50 rounded-lg shrink-0">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Delete Meeting</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete &quot;{title}&quot;? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {deleting ? (
                  <>
                    <div className="h-3 w-3 border border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
