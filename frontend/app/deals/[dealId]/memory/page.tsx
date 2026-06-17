"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getDeal, getDealMemory } from "@/lib/api";
import { Brain, ClipboardList, TrendingUp, Star, ArrowLeft, CheckSquare, StickyNote } from "lucide-react";

interface MemoryEntry {
  content: string;
  metadata: Record<string, unknown>;
}

interface MemoryData {
  episodic: MemoryEntry[];
  semantic: MemoryEntry[];
  procedural: MemoryEntry[];
  total_count: number;
}

const sentimentColor: Record<string, string> = {
  positive: "bg-emerald-50 text-emerald-700 border-emerald-200",
  negative:  "bg-red-50 text-red-700 border-red-200",
  mixed:     "bg-amber-50 text-amber-700 border-amber-200",
  neutral:   "bg-slate-100 text-slate-600 border-slate-200",
};

function stripUUIDs(content: string): string {
  return content
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[this deal]")
    .replace(/\[DEAL:[^\]]+\]\s*/g, "")
    .trim();
}

export default function MemoryPage() {
  const params = useParams();
  const dealId = params.dealId as string;
  const [deal, setDeal] = useState<any>(null);
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getDeal(dealId), getDealMemory(dealId)])
      .then(([d, m]) => { setDeal(d); setData(m); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64 rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );

  if (error) return (
    <div className="p-4 text-red-600 border border-red-200 rounded-xl bg-red-50">{error}</div>
  );

  const meetingMemories = (data?.episodic ?? []).filter(
    (m) => !m.metadata?.memory_subtype
  );
  const actionCompletions = (data?.episodic ?? []).filter(
    (m) => m.metadata?.memory_subtype === "action_completion"
  );
  const manualNotes = (data?.episodic ?? []).filter(
    (m) => m.metadata?.memory_subtype === "manual_note"
  );

  const grouped = meetingMemories.reduce((acc, entry) => {
    const mnum = (entry.metadata?.meeting_number as number) ?? 0;
    if (!acc[mnum]) acc[mnum] = [];
    acc[mnum].push(entry);
    return acc;
  }, {} as Record<number, MemoryEntry[]>);

  const sortedGroups = Object.entries(grouped)
    .map(([k, v]) => ({ meetingNumber: Number(k), entries: v }))
    .sort((a, b) => a.meetingNumber - b.meetingNumber);

  const total = data?.total_count ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-surface p-5">
        <div className="flex items-center gap-4">
          <Link href={`/deals/${dealId}`}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 hover:text-slate-700">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">Memory Timeline</h1>
            {deal && <p className="text-sm text-slate-500">{deal.name} — {deal.company}</p>}
          </div>
          <Badge variant="outline" className="shrink-0 text-indigo-600 border-indigo-200 bg-indigo-50">
            <Brain className="h-3 w-3 mr-1" />
            {total} {total === 1 ? "memory" : "memories"}
          </Badge>
        </div>
      </div>

      {/* Memory Depth Indicator */}
      <div className="glass-surface p-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Memory Depth</p>
        <div className="flex gap-3">
          {[
            { label: "Meeting Records", count: sortedGroups.length, color: "bg-indigo-500", active: sortedGroups.length > 0 },
            { label: "Pattern Analysis", count: (data?.semantic ?? []).length, color: "bg-blue-500", active: (data?.semantic ?? []).length > 0 },
            { label: "Strategy Layer",  count: (data?.procedural ?? []).length, color: "bg-emerald-500", active: (data?.procedural ?? []).length > 0 },
          ].map((layer) => (
            <div key={layer.label} className="flex-1">
              <div className={`h-1.5 rounded-full mb-1.5 ${layer.active ? layer.color : "bg-slate-100"}`} />
              <p className={`text-xs ${layer.active ? "text-slate-700 font-medium" : "text-slate-400"}`}>{layer.label}</p>
              <p className={`text-xs ${layer.active ? "text-slate-500" : "text-slate-300"}`}>{layer.count} stored</p>
            </div>
          ))}
        </div>
      </div>

      {/* Meeting Records */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-700">Meeting Records</h2>
          <span className="text-xs text-slate-400 ml-auto">What happened</span>
        </div>
        {sortedGroups.length > 0 ? (
          sortedGroups.map(({ meetingNumber, entries }) => {
            const sentiment = entries.find((e) => e.metadata?.sentiment)?.metadata?.sentiment as string | undefined;
            return (
              <div key={meetingNumber} className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-xl p-4 border-l-4 border-l-indigo-300"
                style={{ boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)" }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
                    Meeting #{meetingNumber}
                  </span>
                  {sentiment && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${sentimentColor[sentiment] ?? sentimentColor.neutral}`}>
                      {sentiment}
                    </span>
                  )}
                </div>
                <ul className="space-y-1.5">
                  {entries.map((entry, idx) => (
                    <li key={idx} className="text-sm text-slate-700 flex gap-2">
                      <span className="text-indigo-300 mt-0.5 shrink-0">•</span>
                      <span>{stripUUIDs(entry.content)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        ) : (
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center bg-white/40">
            <p className="text-sm text-slate-400">No meeting records yet. Process your first meeting to create memory.</p>
          </div>
        )}
      </div>

      {/* Action Completions */}
      {actionCompletions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-slate-700">Actions Completed</h2>
            <span className="text-xs text-slate-400 ml-auto">Follow-through context</span>
          </div>
          {actionCompletions.map((entry, idx) => (
            <div key={idx} className="bg-white/80 backdrop-blur-sm border border-emerald-200/80 rounded-xl p-3 border-l-4 border-l-emerald-400"
              style={{ boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)" }}
            >
              <p className="text-sm text-slate-700">{stripUUIDs(entry.content)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Manual Notes */}
      {manualNotes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-700">Manual Notes</h2>
            <span className="text-xs text-slate-400 ml-auto">Added outside meetings</span>
          </div>
          {manualNotes.map((entry, idx) => (
            <div key={idx} className="bg-white/80 backdrop-blur-sm border border-amber-200/80 rounded-xl p-3 border-l-4 border-l-amber-400"
              style={{ boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)" }}
            >
              <p className="text-sm text-slate-700">{stripUUIDs(entry.content)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Patterns Discovered */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-700">Patterns Discovered</h2>
          <span className="text-xs text-slate-400 ml-auto">Cross-meeting insights</span>
        </div>
        {data?.semantic && data.semantic.length > 0 ? (
          <div className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-xl p-4 border-l-4 border-l-blue-400"
            style={{ boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)" }}
          >
            {Boolean(data.semantic[0].metadata?.updated_after_meeting) && (
              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 mb-3">
                Emerged after Meeting {data.semantic[0].metadata?.updated_after_meeting as number}
              </span>
            )}
            <p className="text-sm text-slate-700 leading-relaxed">{stripUUIDs(data.semantic[0].content)}</p>
          </div>
        ) : (
          <div className="border-2 border-dashed border-blue-100 rounded-xl p-6 text-center bg-white/40">
            <p className="text-sm text-blue-400">Patterns will be detected after your 2nd meeting</p>
          </div>
        )}
      </div>

      {/* Winning Strategies */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-semibold text-slate-700">Winning Strategies</h2>
          <span className="text-xs text-slate-400 ml-auto">What works</span>
        </div>
        {data?.procedural && data.procedural.length > 0 ? (
          <div className="bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-xl p-4 border-l-4 border-l-emerald-400"
            style={{ boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)" }}
          >
            {Boolean(data.procedural[0].metadata?.derived_after_meeting) && (
              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mb-3">
                Derived after Meeting {data.procedural[0].metadata?.derived_after_meeting as number}
              </span>
            )}
            <p className="text-sm text-slate-700 leading-relaxed">{stripUUIDs(data.procedural[0].content)}</p>
          </div>
        ) : (
          <div className="border-2 border-dashed border-emerald-100 rounded-xl p-6 text-center bg-white/40">
            <p className="text-sm text-emerald-400">Strategies will be derived after your 3rd meeting</p>
          </div>
        )}
      </div>

      <p className="text-xs text-center text-slate-400 pb-4">
        {total === 0
          ? "Record your first meeting to begin building deal memory."
          : `The agent has ${total} ${total === 1 ? "memory" : "memories"} of this deal and gets smarter with every meeting.`}
      </p>
    </div>
  );
}
