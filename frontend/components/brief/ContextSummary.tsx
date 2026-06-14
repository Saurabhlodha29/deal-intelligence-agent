"use client";

import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";

interface Props {
  dealContext: string;
  meetingHistorySummary: string;
}

export default function ContextSummary({ dealContext, meetingHistorySummary }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deal Context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Summary</p>
          <p className="text-gray-700 text-sm">{dealContext}</p>
        </div>
        {meetingHistorySummary && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Meeting History</p>
            <p className="text-gray-700 text-sm">{meetingHistorySummary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
