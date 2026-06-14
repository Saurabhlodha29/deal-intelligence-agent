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

  if (loading) return <div className="p-4 text-gray-500 animate-pulse">Loading memory…</div>;
  if (error) return <div className="p-4 text-red-600 border border-red-200 rounded bg-red-50">Error: {error}</div>;
  if (!data) return null;

  const totalMemories = data.total_count ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="h-6 w-6 text-indigo-600" />
        <h2 className="text-2xl font-semibold">What the Agent Has Learned</h2>
        <Badge variant="outline" className="ml-auto">
          {totalMemories} {totalMemories === 1 ? "memory" : "memories"}
        </Badge>
      </div>

      {/* Section 1: Episodic Memories */}
      {data.episodic && data.episodic.length > 0 ? (
        <Card className="border-indigo-200">
          <CardHeader className="bg-indigo-50 rounded-t-lg">
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
                <div key={idx} className="border border-indigo-100 rounded-lg p-3 bg-white shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-sm text-indigo-700">
                      Meeting #{mnum}
                    </span>
                    {sentiment && (
                      <Badge variant="outline" className={
                        sentiment === "positive" ? "text-green-700 border-green-300" :
                        sentiment === "negative" ? "text-red-700 border-red-300" :
                        sentiment === "mixed" ? "text-yellow-700 border-yellow-300" :
                        "text-gray-600 border-gray-300"
                      }>
                        {sentiment}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                    {entry.content}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center text-gray-400 text-sm">
            No meeting records yet. Process your first meeting to create memory.
          </CardContent>
        </Card>
      )}

      {/* Section 2: Semantic Memory (Patterns) */}
      {data.semantic && data.semantic.length > 0 ? (
        <Card className="border-blue-200">
          <CardHeader className="bg-blue-50 rounded-t-lg">
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
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {data.semantic[0].content}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-blue-200">
          <CardContent className="py-6 text-center text-sm">
            <p className="text-blue-400">Patterns will be detected after your 2nd meeting</p>
          </CardContent>
        </Card>
      )}

      {/* Section 3: Procedural Memory (Strategies) */}
      {data.procedural && data.procedural.length > 0 ? (
        <Card className="border-green-200">
          <CardHeader className="bg-green-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Star className="h-5 w-5" />
              Winning Strategies
              {data.procedural[0]?.metadata?.derived_after_meeting && (
                <Badge className="bg-green-600 text-white ml-auto text-xs">
                  Derived after Meeting {data.procedural[0].metadata.derived_after_meeting}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {data.procedural[0].content}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-green-200">
          <CardContent className="py-6 text-center text-sm">
            <p className="text-green-400">Strategies will be derived after your 3rd meeting</p>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <p className="text-xs text-gray-400 text-center pb-2">
        {totalMemories === 0
          ? "Record your first meeting to begin building deal memory."
          : `The agent has ${totalMemories} ${totalMemories === 1 ? "memory" : "memories"} of this deal and gets smarter with every meeting.`}
      </p>
    </div>
  );
}