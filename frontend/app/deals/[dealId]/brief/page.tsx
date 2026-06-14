"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getDeal, getDealBrief } from "@/lib/api";

interface Brief {
  deal_context: string;
  meeting_history_summary: string;
  recurring_risks: { risk: string; severity: string; appeared_in_meetings: number[] }[];
  recommended_strategies: { strategy: string; reasoning: string }[];
  stakeholders_to_know: { name: string; role: string; key_concern: string }[];
  competitor_context: string;
  confidence: "low" | "medium" | "high";
  memory_sources: { episodic_count: number; semantic_count: number; procedural_count: number };
}

const confidenceColors = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-green-100 text-green-800",
};

const severityColors = {
  high: "border-red-400 bg-red-50",
  medium: "border-yellow-400 bg-yellow-50",
  low: "border-gray-300 bg-gray-50",
};

export default function BriefPage() {
  const params = useParams();
  const dealId = params.dealId as string;
  const [deal, setDeal] = useState<any>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getDeal(dealId), getDealBrief(dealId)])
      .then(([d, b]) => { setDeal(d); setBrief(b); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [dealId]);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link href={`/deals/${dealId}`}>
          <Button variant="outline" size="sm">← Back to Deal</Button>
        </Link>
        <h1 className="text-2xl font-bold">Pre-Meeting Brief</h1>
      </div>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {error && (
        <div className="p-4 text-red-600 border border-red-200 rounded bg-red-50">
          {error}
        </div>
      )}

      {!loading && !error && brief && deal && (
        <div className="space-y-5">
          {/* Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{deal.company}</span>
                <Badge className={confidenceColors[brief.confidence]}>
                  {brief.confidence} confidence
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-500">
                Based on {brief.memory_sources.episodic_count} meeting records
                {brief.memory_sources.semantic_count > 0 && ` · ${brief.memory_sources.semantic_count} pattern analysis`}
                {brief.memory_sources.procedural_count > 0 && ` · strategy insights`}
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{brief.deal_context}</p>
            </CardContent>
          </Card>

          {/* Meeting History */}
          <Card>
            <CardHeader><CardTitle>📋 Meeting History</CardTitle></CardHeader>
            <CardContent>
              <p className="text-gray-700 text-sm">{brief.meeting_history_summary}</p>
            </CardContent>
          </Card>

          {/* Risks */}
          {brief.recurring_risks.length > 0 && (
            <Card>
              <CardHeader><CardTitle>⚠️ Risks to Watch</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {brief.recurring_risks.map((r, i) => (
                  <div key={i} className={`border-l-4 p-3 rounded ${severityColors[r.severity as keyof typeof severityColors] || severityColors.low}`}>
                    <p className="font-medium text-sm">{r.risk}</p>
                    {r.appeared_in_meetings?.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Appeared in meetings: {r.appeared_in_meetings.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Stakeholders */}
          {brief.stakeholders_to_know.length > 0 && (
            <Card>
              <CardHeader><CardTitle>👥 Key Stakeholders</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {brief.stakeholders_to_know.map((s, i) => (
                  <div key={i} className="border rounded p-3">
                    <p className="font-semibold text-sm">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.role}</p>
                    <p className="text-sm mt-1 text-gray-700">{s.key_concern}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Strategies */}
          {brief.recommended_strategies.length > 0 && (
            <Card>
              <CardHeader><CardTitle>🏆 Recommended Strategies</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {brief.recommended_strategies.map((s, i) => (
                  <div key={i} className="border-l-4 border-green-400 pl-3">
                    <p className="font-medium text-sm">{s.strategy}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.reasoning}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Competitor Context */}
          {brief.competitor_context && brief.competitor_context !== "No data available." && (
            <Card>
              <CardHeader><CardTitle>🎯 Competitive Context</CardTitle></CardHeader>
              <CardContent>
                <p className="text-gray-700 text-sm">{brief.competitor_context}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}