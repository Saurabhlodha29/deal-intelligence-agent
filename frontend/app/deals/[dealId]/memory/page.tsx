"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getDeal, getDealMemory } from "@/lib/api";
import { Brain, ClipboardList, TrendingUp, Star, ArrowLeft } from "lucide-react";

interface MemoryEntry {
  content: string;
  metadata: Record<string, any>;
  memory_type: string;
}

interface MemoryData {
  episodic: MemoryEntry[];
  semantic: MemoryEntry[];
  procedural: MemoryEntry[];
  total_count: number;
}

const sentimentColor: Record<string, string> = {
  positive: "bg-emerald-50 text-emerald-700 border-emerald-200",
  negative: "bg-red-50 text-red-700 border-red-200",
  mixed: "bg-amber-50 text-amber-700 border-amber-200",
  neutral: "bg-slate-100 text-slate-600 border-slate-200",
};

function transformMemories(raw: any): MemoryData {
  return {
    episodic: raw.episodic ?? [],
    semantic: raw.semantic ?? [],
    procedural: raw.procedural ?? [],
    total_count: raw.total_count ?? (raw.episodic?.length ?? 0) + (raw.semantic?.length ?? 0) + (raw.procedural?.length ?? 0),
  };
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
      .then(([d, m]) => { setDeal(d); setData(transformMemories(m)); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );

  if (error) return (
    <div className="p-4 text-red-600 border border-red-200 rounded-xl bg-red-50">{error}</div>
  );

  const total = data?.total_count ?? 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/deals/${dealId}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900">Memory Timeline</h1>
          {deal && <p className="text-sm text-slate-500">{deal.name} — {deal.company}</p>}
        </div>
        <Badge variant="outline" className="shrink-0 text-indigo-600 border-indigo-200 bg-indigo-50">
          <Brain className="h-3 w-3 mr-1" /> {total} {total === 1 ? "memory" : "memories"}
        </Badge>
      </div>

      {/* Learning Progression Bar */}
      {data && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Memory Depth</p>
          <div className="flex gap-2">
            {[
              { label: "Meeting Records", count: data.episodic.length, color: "bg-indigo-500", active: data.episodic.length > 0 },
              { label: "Pattern Analysis", count: data.semantic.length, color: "bg-blue-500", active: data.semantic.length > 0 },
              { label: "Strategy Layer", count: data.procedural.length, color: "bg-emerald-500", active: data.procedural.length > 0 },
            ].map((layer) => (
              <div key={layer.label} className="flex-1">
                <div className={`h-2 rounded-full mb-1.5 ${layer.active ? layer.color : "bg-slate-100"}`} />
                <p className={`text-xs ${layer.active ? "text-slate-700 font-medium" : "text-slate-400"}`}>{layer.label}</p>
                <p className={`text-xs ${layer.active ? "text-slate-500" : "text-slate-300"}`}>{layer.count} stored</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Episodic Memories */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-700">Meeting Records</h2>
          <span className="text-xs text-slate-400 ml-auto">What happened</span>
        </div>
        {data?.episodic && data.episodic.length > 0 ? (
          data.episodic.map((entry, idx) => {
            const mnum = entry.metadata?.meeting_number ?? idx + 1;
            const sentiment = entry.metadata?.sentiment;
            return (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm border-l-4 border-l-indigo-300">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                    Meeting #{mnum}
                  </span>
                  {sentiment && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${sentimentColor[sentiment] || sentimentColor.neutral}`}>
                      {sentiment}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{entry.content}</p>
              </div>
            );
          })
        ) : (
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
            <p className="text-sm text-slate-400">No meeting records yet. Process your first meeting to create memory.</p>
          </div>
        )}
      </div>

      {/* Semantic Memory */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-700">Patterns Discovered</h2>
          <span className="text-xs text-slate-400 ml-auto">Cross-meeting insights</span>
        </div>
        {data?.semantic && data.semantic.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm border-l-4 border-l-blue-400">
            {data.semantic[0].metadata?.updated_after_meeting && (
              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 mb-3">
                Emerged after Meeting {data.semantic[0].metadata.updated_after_meeting}
              </span>
            )}
            <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{data.semantic[0].content}</p>
          </div>
        ) : (
          <div className="border-2 border-dashed border-blue-100 rounded-xl p-6 text-center">
            <p className="text-sm text-blue-400">Patterns will be detected after your 2nd meeting</p>
          </div>
        )}
      </div>

      {/* Procedural Memory */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-semibold text-slate-700">Winning Strategies</h2>
          <span className="text-xs text-slate-400 ml-auto">What works</span>
        </div>
        {data?.procedural && data.procedural.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm border-l-4 border-l-emerald-400">
            {data.procedural[0].metadata?.derived_after_meeting && (
              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mb-3">
                Derived after Meeting {data.procedural[0].metadata.derived_after_meeting}
              </span>
            )}
            <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{data.procedural[0].content}</p>
          </div>
        ) : (
          <div className="border-2 border-dashed border-emerald-100 rounded-xl p-6 text-center">
            <p className="text-sm text-emerald-400">Strategies will be derived after your 3rd meeting</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-center text-slate-400 pb-4">
        {total === 0
          ? "Record your first meeting to begin building deal memory."
          : `The agent has ${total} ${total === 1 ? "memory" : "memories"} of this deal and gets smarter with every meeting.`}
      </p>
    </div>
  );
}
