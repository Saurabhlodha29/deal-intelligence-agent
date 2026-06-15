"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Deal, Meeting, DealSummary } from "@/lib/types";
import { getDeal, getMeetings, getDealSummary, addManualNote, uploadAudio, createMeeting } from "@/lib/api";
import MeetingCard from "@/components/meetings/MeetingCard";
import MeetingRecorder from "@/components/meetings/MeetingRecorder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const stageColors: Record<string, string> = {
  discovery: "bg-gray-200 text-gray-800",
  qualification: "bg-indigo-200 text-indigo-800",
  proposal: "bg-blue-200 text-blue-800",
  negotiation: "bg-yellow-200 text-yellow-800",
  closed_won: "bg-green-200 text-green-800",
  closed_lost: "bg-red-200 text-red-800",
};

const riskColors: Record<string, string> = {
  low: "text-green-700",
  medium: "text-yellow-700",
  high: "text-red-600",
  critical: "text-red-800 font-bold",
  unknown: "text-gray-400",
};

export default function DealDetailPage() {
  const params = useParams();
  const dealId = params.dealId as string;

  const [deal, setDeal] = useState<Deal | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [summary, setSummary] = useState<DealSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [d, m, s] = await Promise.all([
          getDeal(dealId),
          getMeetings(dealId),
          getDealSummary(dealId),
        ]);
        setDeal(d);
        setMeetings(m);
        setSummary(s);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dealId]);

  const handleMeetingComplete = () => {
    // Refresh meetings and summary after processing
    getMeetings(dealId).then(setMeetings);
    getDealSummary(dealId).then(setSummary);
  };

  const handleRetryComplete = () => {
    // Refresh meetings after retry
    getMeetings(dealId).then(setMeetings);
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setNoteSaving(true);
    try {
      await addManualNote(dealId, noteText.trim());
      setNoteText("");
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 3000);
    } catch (e) {
      console.error("Failed to save note:", e);
    } finally {
      setNoteSaving(false);
    }
  };

  const handleUploadRecording = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !deal) return;
    setUploadingFile(true);
    try {
      const title = `Uploaded: ${file.name.replace(/\.[^/.]+$/, "")} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      const meeting = await createMeeting(dealId, { title });
      const audioBlob = new Blob([await file.arrayBuffer()], { type: file.type });
      await uploadAudio(meeting.id, audioBlob);
      getMeetings(dealId).then(setMeetings);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
          <Skeleton className="h-48 lg:col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;
  if (!deal) return <div className="p-4">Deal not found.</div>;

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-2">← All Deals</Button>
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">{deal.name}</h1>
            <p className="text-xl text-gray-600">{deal.company}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge className={stageColors[deal.stage] || "bg-gray-200 text-gray-800"}>
                {deal.stage.replace(/_/g, " ")}
              </Badge>
              {deal.deal_value && (
                <span className="text-gray-700 font-medium">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: deal.currency }).format(deal.deal_value)}
                </span>
              )}
              <span className="text-gray-500 text-sm">{deal.total_meetings} meetings</span>
            </div>
          </div>
          {/* Navigation buttons */}
          <div className="flex gap-2 flex-wrap">
            <Link href={`/deals/${dealId}/brief`}>
              <Button variant="outline">📋 Pre-Meeting Brief</Button>
            </Link>
            <Link href={`/deals/${dealId}/memory`}>
              <Button variant="outline">🧠 Memory Timeline</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Meetings Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Recorder */}
          <MeetingRecorder dealId={dealId} onMeetingComplete={handleMeetingComplete} />

          {/* Meetings List */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Meetings</h2>
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.webm,.mp4,.mp3,.wav,.m4a"
                className="hidden"
                onChange={handleUploadRecording}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
              >
                {uploadingFile ? "⏳ Uploading..." : "📁 Upload Recording"}
              </Button>
            </>
          </div>
          {meetings.length === 0 ? (
            <p className="text-gray-500 text-sm">No meetings yet. Record one above or create manually.</p>
          ) : (
            <div className="space-y-3">
              {meetings.map((m) => (
                <MeetingCard key={m.id} meeting={m} dealId={dealId} onRetryComplete={handleRetryComplete} />
              ))}
            </div>
          )}
        </div>

        {/* Memory Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                🧠 Deal Memory
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!summary || summary.total_meetings === 0 ? (
                <p className="text-gray-400 text-sm">Memory will appear here after your first meeting is processed.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Risk Level</p>
                    <p className={`text-lg font-semibold capitalize ${riskColors[summary.deal_risk_level] || riskColors.unknown}`}>
                      {summary.deal_risk_level}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Sentiment Trend</p>
                    <p className="font-medium capitalize">{summary.sentiment_trend}</p>
                  </div>
                  {summary.recurring_objections?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Recurring Objections</p>
                      <ul className="space-y-1">
                        {summary.recurring_objections.slice(0, 3).map((o, i) => (
                          <li key={i} className="text-sm text-gray-700">
                            • {o.text} <span className="text-gray-400">({o.count}×)</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Link href={`/deals/${dealId}/memory`}>
                    <Button variant="ghost" size="sm" className="w-full mt-2 text-indigo-600">
                      View Full Memory Timeline →
                    </Button>
                  </Link>
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-600 mb-2">
                  📝 Tell the agent something
                </p>
                <p className="text-xs text-slate-400 mb-2">
                  Happened outside a meeting? Add context here.
                </p>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="e.g. CFO emailed budget approval. We lowered price by 10%."
                  className="w-full text-xs p-2 border border-slate-200 rounded resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  rows={3}
                />
                <button
                  onClick={handleSaveNote}
                  disabled={noteSaving || !noteText.trim()}
                  className="mt-2 w-full text-xs py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                  {noteSaving ? "Saving to memory..." : noteSaved ? "✓ Saved to agent memory!" : "Save to Agent Memory"}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}