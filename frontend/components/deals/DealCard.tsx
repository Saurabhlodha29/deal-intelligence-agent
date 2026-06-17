// components/deals/DealCard.tsx
"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Deal } from "@/lib/types";
import { Brain, CalendarDays } from "lucide-react";

interface DealCardProps {
  deal: Deal;
  onClick?: () => void;
}

const stageColors: Record<Deal["stage"], string> = {
  discovery: "bg-slate-100 text-slate-700 border-slate-200",
  qualification: "bg-violet-50 text-violet-700 border-violet-200",
  proposal: "bg-blue-50 text-blue-700 border-blue-200",
  negotiation: "bg-amber-50 text-amber-700 border-amber-200",
  closed_won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed_lost: "bg-red-50 text-red-600 border-red-200",
};

function getMemoryStrength(meetings: number): { label: string; color: string; bg: string } {
  if (meetings >= 3) return { label: "Strong Memory", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" };
  if (meetings >= 1) return { label: "Building Context", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" };
  return { label: "Low Context", color: "text-slate-500", bg: "bg-slate-50 border-slate-200" };
}

export default function DealCard({ deal, onClick }: DealCardProps) {
  const formattedValue = deal.deal_value
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: deal.currency,
      }).format(deal.deal_value)
    : "—";

  const memory = getMemoryStrength(deal.total_meetings || 0);

  return (
    <Card
      className={`bg-white/80 backdrop-blur-sm border-slate-200/80 hover:shadow-lg hover:border-slate-300/80 transition-all duration-200 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold text-slate-900">
          {deal.company}
        </CardTitle>

        <div className="text-sm text-slate-500">
          {deal.name}
        </div>

        <Badge className={`text-xs border ${stageColors[deal.stage]}`}>
          {deal.stage.replace("_", " ")}
        </Badge>
      </CardHeader>

      <CardContent className="mt-2">
        <div className="text-lg font-medium text-slate-800">{formattedValue}</div>

        <div className="flex items-center gap-2 mt-2">
          <span className="flex items-center gap-1 text-sm text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" />
            {deal.total_meetings} meetings
          </span>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${memory.bg}`}>
            <Brain className={`h-3 w-3 ${memory.color}`} />
            <span className={memory.color}>{memory.label}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
