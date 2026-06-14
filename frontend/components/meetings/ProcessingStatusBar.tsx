"use client";

import React from "react";
import { ProcessingStatus } from "@/lib/types";

interface Props {
  status: ProcessingStatus;
}

export default function ProcessingStatusBar({ status }: Props) {
  const steps = ["transcribing", "extracting", "storing_memory", "complete"];
  const currentIdx = steps.indexOf(status.status);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{status.step_message}</p>
      <div className="flex gap-2 flex-wrap">
        {steps.map((step) => {
          const stepIdx = steps.indexOf(step);
          const isDone = stepIdx < currentIdx;
          const isActive = step === status.status;
          return (
            <span
              key={step}
              className={`text-xs px-2 py-1 rounded-full border ${
                isDone
                  ? "bg-green-100 text-green-800 border-green-200"
                  : isActive
                  ? "bg-blue-100 text-blue-800 border-blue-200 animate-pulse"
                  : "bg-gray-100 text-gray-400 border-gray-200"
              }`}
            >
              {isDone ? "✓ " : isActive ? "⟳ " : ""}
              {step.replace("_", " ")}
            </span>
          );
        })}
      </div>
      {status.error && (
        <p className="text-xs text-red-600 mt-1">{status.error}</p>
      )}
    </div>
  );
}
