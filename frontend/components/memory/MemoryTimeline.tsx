"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, ClipboardList, Star, TrendingUp } from "lucide-react";

interface MemoryEntry {
  content: string;
  metadata: Record<string, any>;
}

interface MemoryData {
  episodic: MemoryEntry[];
  semantic: MemoryEntry[];
  procedural: MemoryEntry[];
  total_count: number;
}

interface Props {
  dealId: string;
}

export default function MemoryTimeline({ dealId }: Props) {
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMemory() {
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${API_BASE}/api/v1/deals/${dealId}/memory`);
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchMemory();
  }, [dealId]);

  if (loading) return <div className="p-4 text-slate-500 animate-pulse">Loading memory…</div>;
  if (error) return <div className="p-4 text-red-600 border border-red-200 rounded-xl bg-red-50">Error: {error}</div>;
  if (!data) return null;

  const totalMemories = data.total_count ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-indigo-50 rounded-lg">
          <Brain className="h-5 w-5 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900">What the Agent Has Learned</h2>
        <Badge variant="outline" className="ml-auto text-indigo-600 border-indigo-200 bg-indigo-50">
          {totalMemories} {totalMemories === 1 ? "memory" : "memories"}
        </Badge>
      </div>

      {/* Section 1: Episodic Memories */}
      {data.episodic && data.episodic.length > 0 ? (
        <Card className="border-indigo-200/80 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-indigo-50/80 rounded-t-lg border-b border-indigo-100">
            <CardTitle className="flex items-center gap-2 text-indigo-800">
              <ClipboardList className="h-5 w-5" />
              Meeting Records
              <Badge className="bg-indigo-600 text-white ml-auto">
                {data.episodic.length} {data.episodic.length === 1 ? "record" : "records"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {data.episodic.map((entry, idx) => {
              const mnum = entry.metadata?.meeting_number ?? idx + 1;
              const sentiment = entry.metadata?.sentiment;
              return (
                <div key={idx} className="border border-indigo-100 rounded-lg p-3 bg-white/80"
                  style={{ boxShadow: "0 1px 2px 0 rgba(0,0,0,0.03)" }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-sm text-indigo-700">
                      Meeting #{mnum}
                    </span>
                    {sentiment && (
                      <Badge variant="outline" className={
                        sentiment === "positive" ? "text-emerald-700 border-emerald-300 bg-emerald-50" :
                        sentiment === "negative" ? "text-red-700 border-red-300 bg-red-50" :
                        sentiment === "mixed" ? "text-amber-700 border-amber-300 bg-amber-50" :
                        "text-slate-600 border-slate-300 bg-slate-50"
                      }>
                        {sentiment}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                    {entry.content}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-slate-200 bg-white/40">
          <CardContent className="py-6 text-center text-slate-400 text-sm">
            No meeting records yet. Process your first meeting to create memory.
          </CardContent>
        </Card>
      )}

      {/* Section 2: Semantic Memory (Patterns) */}
      {data.semantic && data.semantic.length > 0 ? (
        <Card className="border-blue-200/80 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-blue-50/80 rounded-t-lg border-b border-blue-100">
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <TrendingUp className="h-5 w-5" />
              Patterns Discovered
              {data.semantic[0]?.metadata?.updated_after_meeting && (
                <Badge className="bg-blue-600 text-white ml-auto text-xs">
                  Emerged after Meeting {data.semantic[0].metadata.updated_after_meeting}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
              {data.semantic[0].content}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-blue-200 bg-white/40">
          <CardContent className="py-6 text-center text-sm">
            <p className="text-blue-400">Patterns will be detected after your 2nd meeting</p>
          </CardContent>
        </Card>
      )}

      {/* Section 3: Procedural Memory (Strategies) */}
      {data.procedural && data.procedural.length > 0 ? (
        <Card className="border-emerald-200/80 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-emerald-50/80 rounded-t-lg border-b border-emerald-100">
            <CardTitle className="flex items-center gap-2 text-emerald-800">
              <Star className="h-5 w-5" />
              Winning Strategies
              {data.procedural[0]?.metadata?.derived_after_meeting && (
                <Badge className="bg-emerald-600 text-white ml-auto text-xs">
                  Derived after Meeting {data.procedural[0].metadata.derived_after_meeting}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
              {data.procedural[0].content}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-emerald-200 bg-white/40">
          <CardContent className="py-6 text-center text-sm">
            <p className="text-emerald-400">Strategies will be derived after your 3rd meeting</p>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <p className="text-xs text-slate-400 text-center pb-2">
        {totalMemories === 0
          ? "Record your first meeting to begin building deal memory."
          : `The agent has ${totalMemories} ${totalMemories === 1 ? "memory" : "memories"} of this deal and gets smarter with every meeting.`}
      </p>
    </div>
  );
}