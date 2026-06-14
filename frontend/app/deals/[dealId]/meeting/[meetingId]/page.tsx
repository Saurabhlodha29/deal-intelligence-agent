"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getMeeting, getMeetingIntelligence } from "@/lib/api";
import IntelligenceReport from "@/components/intelligence/IntelligenceReport";

export default function MeetingDetailPage() {
  const params = useParams();
  const dealId = params.dealId as string;
  const meetingId = params.meetingId as string;

  const [meetingTitle, setMeetingTitle] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getMeeting(meetingId).then((m) => {
      setMeetingTitle(m.title || `Meeting #${m.meeting_number}`);
      setReady(true);
    });
  }, [meetingId]);

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="mb-4 flex items-center gap-4">
        <Link href={`/deals/${dealId}`}>
          <Button variant="outline" size="sm">← Back to Deal</Button>
        </Link>
        {meetingTitle && <h1 className="text-2xl font-bold">{meetingTitle}</h1>}
      </div>
      {ready && <IntelligenceReport meetingId={meetingId} dealId={dealId} />}
    </div>
  );
}