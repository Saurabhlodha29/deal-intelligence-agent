"use client";

import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Types based on backend intelligence response
interface Intelligence {
  sentiment: "positive" | "negative" | "mixed" | "neutral";
  sentiment_score: number;
  sentiment_reasoning: string;
  objections: { text: string; severity: "low" | "medium" | "high"; was_handled: boolean }[];
  competitors: { name: string; context: string }[];
  stakeholders: { name: string; role: string; sentiment: "positive" | "neutral" | "skeptical" | "negative"; influence: "low" | "medium" | "high" }[];
  action_items: { item: string; owner: "us" | "prospect" | "both"; deadline: string | null }[];
  risks: { risk: string; severity: "low" | "medium" | "high" }[];
}

interface Props {
  meetingId: string;
  dealId: string;
}

export default function IntelligenceReport({ meetingId, dealId }: Props) {
  const [data, setData] = useState<Intelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIntelligence() {
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${API_BASE}/api/v1/meetings/${meetingId}/intelligence`);
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchIntelligence();
  }, [meetingId]);

  if (loading) return <div className="p-4">Loading intelligence…</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
      {/* Sentiment Header – spans both columns */}
      <div className="col-span-2">
        <SentimentHeader data={data} />
      </div>

      {/* Individual sections */}
      <ObjectionsList objections={data.objections} />
      <StakeholderGrid stakeholders={data.stakeholders} />
      <CompetitorTags competitors={data.competitors} />
      <ActionItemsList items={data.action_items} />
      <RiskIndicator risks={data.risks} />
    </div>
  );
}

function SentimentHeader({ data }: { data: Intelligence }) {
  const colorMap: Record<string, string> = {
    positive: "bg-green-100 text-green-800",
    negative: "bg-red-100 text-red-800",
    mixed: "bg-yellow-100 text-yellow-800",
    neutral: "bg-gray-100 text-gray-800",
  };
  const bg = colorMap[data.sentiment] ?? "bg-gray-100 text-gray-800";
  const progress = Math.round(((data.sentiment_score + 1) / 2) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className={`${bg} inline-block px-2 py-1 rounded`}>Sentiment: {data.sentiment}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-2">
          <Progress value={progress} className="w-2/3" />
          <span className="font-medium">Score: {data.sentiment_score.toFixed(2)}</span>
        </div>
        <p className="italic text-sm">{data.sentiment_reasoning}</p>
      </CardContent>
    </Card>
  );
}

function ObjectionsList({ objections }: { objections: Intelligence["objections"] }) {
  const severityColors: Record<string, string> = { high: "red", medium: "yellow", low: "gray" };
  return (
    <Card>
      <CardHeader><CardTitle>Objections</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {objections.map((o, i) => (
          <div key={i} className="flex items-center justify-between border rounded p-2">
            <span>{o.text}</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={
                o.severity === "high" ? "bg-red-100 text-red-800" :
                o.severity === "medium" ? "bg-yellow-100 text-yellow-800" :
                "bg-gray-100 text-gray-800"
              }>Severity: {o.severity}</Badge>
              <Badge variant={o.was_handled ? "default" : "destructive"}>
                {o.was_handled ? "Handled" : "Unresolved"}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StakeholderGrid({ stakeholders }: { stakeholders: Intelligence["stakeholders"] }) {
  const sentimentIcons: Record<string, React.JSX.Element> = {
    positive: <span className="text-green-500" role="img" aria-label="positive">😊</span>,
    neutral: <span className="text-gray-500" role="img" aria-label="neutral">😐</span>,
    skeptical: <span className="text-yellow-500" role="img" aria-label="skeptical">🤨</span>,
    negative: <span className="text-red-500" role="img" aria-label="negative">😟</span>,
  };
  return (
    <Card>
      <CardHeader><CardTitle>Stakeholders</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {stakeholders.map((s, i) => (
          <div key={i} className="border rounded p-3 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">{s.name}</span>
              {sentimentIcons[s.sentiment]}
            </div>
            <span className="text-sm text-muted-foreground">{s.role}</span>
            <Badge variant="secondary" className="bg-indigo-100 text-indigo-800">Influence: {s.influence}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CompetitorTags({ competitors }: { competitors: Intelligence["competitors"] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Competitors</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {competitors.map((c, i) => (
          <TooltipProvider key={i}>
            <Tooltip>
              <TooltipTrigger render={<Badge variant="outline" className="bg-blue-50 text-blue-800 cursor-pointer" />}>
                {c.name}
              </TooltipTrigger>
              <TooltipContent>{c.context}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </CardContent>
    </Card>
  );
}

function ActionItemsList({ items }: { items: Intelligence["action_items"] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Action Items</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="checkbox" readOnly className="h-4 w-4 rounded" />
            <span>{a.item}</span>
            <Badge variant="secondary" className="ml-auto">Owner: {a.owner}</Badge>
            {a.deadline && <Badge variant="outline">Due: {a.deadline}</Badge>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RiskIndicator({ risks }: { risks: Intelligence["risks"] }) {
  const borderMap: Record<string, string> = { high: "border-red-500", medium: "border-yellow-500", low: "border-gray-500" };
  const bgMap: Record<string, string> = { high: "bg-red-100", medium: "bg-yellow-100", low: "bg-gray-100" };
  return (
    <Card>
      <CardHeader><CardTitle>Risks</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {risks.map((r, i) => (
          <div key={i} className={`border-l-4 ${borderMap[r.severity]} p-2 ${bgMap[r.severity]} rounded`}> 
            <p className="font-medium">{r.risk}</p>
            <Badge variant="secondary" className={
              r.severity === "high" ? "bg-red-100 text-red-800" :
              r.severity === "medium" ? "bg-yellow-100 text-yellow-800" :
              "bg-gray-100 text-gray-800"
            }>Severity: {r.severity}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
