// components/meetings/MeetingCard.tsx
"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Meeting } from "@/lib/types";
import Link from "next/link";
import { format } from "date-fns";

interface MeetingCardProps {
  meeting: Meeting;
  dealId: string;
}

const statusColors: Record<Meeting["processing_status"], string> = {
  pending: "bg-gray-200 text-gray-800",
  transcribing: "bg-blue-200 text-blue-800",
  extracting: "bg-indigo-200 text-indigo-800",
  storing_memory: "bg-purple-200 text-purple-800",
  complete: "bg-green-200 text-green-800",
  failed: "bg-red-200 text-red-800",
};

export default function MeetingCard({ meeting, dealId }: MeetingCardProps) {
  const formattedDate = format(new Date(meeting.meeting_date), "PPP p");
  const title = meeting.title ?? `Meeting #${meeting.meeting_number ?? ""}`;

  const content = (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-medium">{title}</CardTitle>
        <Badge className={statusColors[meeting.processing_status]}>
          {meeting.processing_status.replace("_", " ")}
        </Badge>
      </CardHeader>
      <CardContent className="text-sm text-gray-600">{formattedDate}</CardContent>
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
