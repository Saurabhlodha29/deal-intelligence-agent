"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, ClipboardList, Star } from "lucide-react";

// Expected memory API shape (simplified)
interface MemoryResponse {
  episodic: Array<{ meeting_number: number; date: string; summary: string }>;
  semantic?: { patterns: string[]; emerged_after_meeting?: number };
  procedural?: { what_works: string[]; what_doesnt_work: string[]; emerged_after_meeting?: number };
}

interface Props {
  dealId: string;
}

export default function MemoryTimeline({ dealId }: Props) {
  const [data, setData] = useState<MemoryResponse | null>(null);
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

  if (loading) return <div className="p-4">Loading memory…</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;
  if (!data) return null;

  const totalMemories = (data.episodic?.length ?? 0) + (data.semantic ? 1 : 0) + (data.procedural ? 1 : 0);

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="h-6 w-6 text-indigo-600" />
        <h2 className="text-2xl font-semibold">What the Agent Has Learned</h2>
      </div>

      {/* Episodic Memories */}
      {data.episodic && data.episodic.length > 0 && (
        <section>
          <Card className="bg-indigo-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" /> Meeting Records
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.episodic.map((e) => (
                <div key={e.meeting_number} className="border border-indigo-200 rounded p-3 bg-white shadow-sm">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Meeting #{e.meeting_number}</span>
                    <span>{new Date(e.date).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1 text-gray-800">{e.summary}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Semantic Memories */}
      {data.semantic && (
        <section>
          <Card className="bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" /> Patterns Discovered
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.semantic.emerged_after_meeting && (
                <Badge className="mb-2">Emerged after Meeting {data.semantic.emerged_after_meeting}</Badge>
              )}
              <ul className="list-disc list-inside space-y-1">
                {data.semantic.patterns.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Procedural Memories */}
      {data.procedural && (
        <section>
          <Card className="bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" /> Winning Strategies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.procedural.emerged_after_meeting && (
                <Badge className="mb-2">Derived after Meeting {data.procedural.emerged_after_meeting}</Badge>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-1">What Works</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {data.procedural.what_works.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-1">What Doesn’t Work</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {data.procedural.what_doesnt_work.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Fallback when few meetings */}
      {data.episodic && data.episodic.length < 2 && (
        <div className="text-center text-gray-600 italic">More patterns will emerge as you log more meetings.</div>
      )}

      {/* Footer summary */}
      <div className="text-sm text-gray-500">The agent has {totalMemories} memories of this deal and gets smarter with every meeting.</div>
    </div>
  );
}
