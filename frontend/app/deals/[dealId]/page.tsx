"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Deal, Meeting, DealSummary } from "@/lib/types";
import { getDeal, getMeetings, getDealSummary, addManualNote, uploadAudio, createMeeting, getMeetingStatus } from "@/lib/api";
import MeetingCard from "@/components/meetings/MeetingCard";
import MeetingRecorder from "@/components/meetings/MeetingRecorder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Clock, Shield, CalendarDays } from "lucide-react";

const stageColors: Record<string, string> = {
  discovery: "bg-slate-100 text-slate-700 border-slate-200",
  qualification: "bg-violet-50 text-violet-700 border-violet-200",
  proposal: "bg-blue-50 text-blue-700 border-blue-200",
  negotiation: "bg-amber-50 text-amber-700 border-amber-200",
  closed_won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed_lost: "bg-red-50 text-red-600 border-red-200",
};

const riskColors: Record<string, string> = {
  low: "text-emerald-700",
  medium: "text-amber-700",
  high: "text-red-600",
  critical: "text-red-800 font-bold",
  unknown: "text-slate-400",
};

function getMemoryStrength(meetings: number): { label: string; color: string; bg: string } {
  if (meetings >= 3) return { label: "Strong Memory", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" };
  if (meetings >= 1) return { label: "Building Context", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" };
  return { label: "Low Context", color: "text-slate-500", bg: "bg-slate-50 border-slate-200" };
}

function getDealHealth(meetings: number): { label: string; color: string; bg: string; dot: string } {
  if (meetings >= 4) return { label: "Healthy", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" };
  if (meetings >= 2) return { label: "At Risk", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-500" };
  if (meetings === 1) return { label: "Critical", color: "text-red-600", bg: "bg-red-50 border-red-200", dot: "bg-red-500" };
  return { label: "New", color: "text-slate-500", bg: "bg-slate-50 border-slate-200", dot: "bg-slate-400" };
}

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
  const uploadPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      await uploadAudio(meeting.id, audioBlob, file.name);

      if (uploadPollRef.current) clearInterval(uploadPollRef.current);
      uploadPollRef.current = setInterval(async () => {
        try {
          const status = await getMeetingStatus(meeting.id);
          if (status.status === "complete" || status.status === "failed") {
            clearInterval(uploadPollRef.current!);
            uploadPollRef.current = null;
            getMeetings(dealId).then(setMeetings);
          }
        } catch { /* continue polling */ }
      }, 3000);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-6 w-40 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <Skeleton className="h-48 lg:col-span-2 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) return <div className="p-4 text-red-600 border border-red-200 rounded-xl bg-red-50">{error}</div>;
  if (!deal) return <div className="p-4 text-slate-500">Deal not found.</div>;

  const memory = getMemoryStrength(deal.total_meetings || 0);
  const health = getDealHealth(deal.total_meetings || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-surface p-6">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-2 text-slate-500 hover:text-slate-700">← All Deals</Button>
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{deal.name}</h1>
            <p className="text-xl text-slate-500 mt-1">{deal.company}</p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Badge className={`text-xs border ${stageColors[deal.stage] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                {deal.stage.replace(/_/g, " ")}
              </Badge>
              {deal.deal_value && (
                <span className="text-slate-700 font-medium">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: deal.currency }).format(deal.deal_value)}
                </span>
              )}
              <span className="flex items-center gap-1 text-slate-500 text-sm">
                <CalendarDays className="h-3.5 w-3.5" />
                {deal.total_meetings} meetings
              </span>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${health.bg}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
                <span className={health.color}>{health.label}</span>
              </span>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${memory.bg}`}>
                <Brain className={`h-3 w-3 ${memory.color}`} />
                <span className={memory.color}>{memory.label}</span>
              </span>
            </div>
          </div>
          {/* Navigation buttons */}
          <div className="flex gap-2 flex-wrap">
            <Link href={`/deals/${dealId}/brief`}>
              <Button variant="outline" className="bg-white/80 border-slate-200 hover:bg-white">📋 Pre-Meeting Brief</Button>
            </Link>
            <Link href={`/deals/${dealId}/memory`}>
              <Button variant="outline" className="bg-white/80 border-slate-200 hover:bg-white">🧠 Memory Timeline</Button>
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
            <h2 className="text-xl font-semibold text-slate-900">Meetings</h2>
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.webm,.m4a,.ogg,.flac,.opus,.mpeg,.mpga,audio/*"
                className="hidden"
                onChange={handleUploadRecording}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="bg-white/80 border-slate-200 hover:bg-white"
              >
                {uploadingFile ? "⏳ Uploading..." : "📁 Upload Recording"}
              </Button>
            </>
          </div>
          {meetings.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center bg-white/40">
              <p className="text-slate-500 text-sm">No meetings yet. Record one above or create manually.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.map((m) => (
                <MeetingCard
                  key={m.id}
                  meeting={m}
                  dealId={dealId}
                  onDeleted={(deletedId) => setMeetings((prev) => prev.filter((x) => x.id !== deletedId))}
                />
              ))}
            </div>
          )}
        </div>

        {/* Memory Sidebar */}
        <div className="space-y-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                <div className="p-1.5 bg-indigo-50 rounded-lg">
                  <Brain className="h-4 w-4 text-indigo-600" />
                </div>
                Deal Memory
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!summary || summary.total_meetings === 0 ? (
                <p className="text-slate-400 text-sm">Memory will appear here after your first meeting is processed.</p>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Risk Level
                    </p>
                    <p className={`text-lg font-semibold capitalize ${riskColors[summary.deal_risk_level] || riskColors.unknown}`}>
                      {summary.deal_risk_level}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Sentiment Trend</p>
                    <p className="font-medium capitalize text-slate-700">{summary.sentiment_trend}</p>
                  </div>
                  {summary.recurring_objections?.length > 0 && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Recurring Objections</p>
                      <ul className="space-y-1.5">
                        {summary.recurring_objections.slice(0, 3).map((o, i) => (
                          <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                            <span className="text-slate-300 mt-0.5 shrink-0">•</span>
                            <span>{o.text} <span className="text-slate-400">({o.count}×)</span></span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Link href={`/deals/${dealId}/memory`}>
                    <Button variant="ghost" size="sm" className="w-full mt-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                      View Full Memory Timeline →
                    </Button>
                  </Link>
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                  <span className="p-1 bg-amber-50 rounded">
                    <Clock className="h-3 w-3 text-amber-600" />
                  </span>
                  Tell the agent something
                </p>
                <p className="text-xs text-slate-400 mb-2">
                  Happened outside a meeting? Add context here.
                </p>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="e.g. CFO emailed budget approval. We lowered price by 10%."
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 bg-white/80"
                  rows={3}
                />
                <button
                  onClick={handleSaveNote}
                  disabled={noteSaving || !noteText.trim()}
                  className="mt-2 w-full text-xs py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-all duration-200 font-medium"
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