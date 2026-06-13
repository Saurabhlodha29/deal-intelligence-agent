// app/deals/[dealId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Deal, Meeting } from "@/lib/types";
import { getDeal, getMeetings } from "@/lib/api";
import DealCard from "@/components/deals/DealCard";
import MeetingCard from "@/components/meetings/MeetingCard";
import NewMeetingModal from "@/components/meetings/NewMeetingModal";

export default function DealDetail({ params }: { params: { dealId: string } }) {
  const { dealId } = params;
  const router = useRouter();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadingDeal, setLoadingDeal] = useState(true);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeal = async () => {
    try {
      const data = await getDeal(dealId);
      setDeal(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingDeal(false);
    }
  };

  const fetchMeetings = async () => {
    try {
      const data = await getMeetings(dealId);
      setMeetings(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingMeetings(false);
    }
  };

  useEffect(() => {
    fetchDeal();
    fetchMeetings();
  }, [dealId]);

  const handleMeetingCreated = (newMeeting: Meeting) => {
    setMeetings((prev) => [newMeeting, ...prev]);
  };

  if (loadingDeal || loadingMeetings) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  if (!deal) {
    return <div className="p-4">Deal not found.</div>;
  }

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Header */}
      <div className="col-span-3 mb-4">
        <h1 className="text-3xl font-bold">{deal.name}</h1>
        <p className="text-xl text-gray-600">{deal.company}</p>
        {/* Stage badge */}
        <span className="mt-2 inline-block bg-gray-200 text-gray-800 px-2 py-1 rounded">
          {deal.stage.replace("_", " ")}
        </span>
      </div>

      {/* Meetings list */}
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-semibold">Meetings</h2>
          <NewMeetingModal dealId={dealId} onCreated={handleMeetingCreated} />
        </div>
        {meetings.length === 0 ? (
          <p>No meetings yet.</p>
        ) : (
          <div className="space-y-4">
            {meetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} dealId={dealId} />
            ))}
          </div>
        )}
      </div>

      {/* Deal Memory placeholder */}
      <div className="border border-dashed p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">Deal Memory</h2>
        <p className="text-gray-500">Memory will appear here after your first meeting.</p>
      </div>
    </div>
  );
}
