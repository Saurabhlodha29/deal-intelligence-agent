// components/deals/DealCard.tsx
"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Deal } from "@/lib/types";

interface DealCardProps {
  deal: Deal;
  onClick?: () => void;
}

const stageColors: Record<Deal["stage"], string> = {
  discovery: "bg-gray-200 text-gray-800",
  qualification: "bg-indigo-200 text-indigo-800",
  proposal: "bg-blue-200 text-blue-800",
  negotiation: "bg-yellow-200 text-yellow-800",
  closed_won: "bg-green-200 text-green-800",
  closed_lost: "bg-red-200 text-red-800",
};

export default function DealCard({ deal, onClick }: DealCardProps) {
  const formattedValue = deal.deal_value
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: deal.currency,
      }).format(deal.deal_value)
    : "—";

  return (
    <Card
      className={`hover:shadow-lg ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {deal.company}
        </CardTitle>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          {deal.name}
        </div>

        <Badge className={stageColors[deal.stage]}>
          {deal.stage.replace("_", " ")}
        </Badge>
      </CardHeader>

      <CardContent className="mt-2">
        <div className="text-lg font-medium">{formattedValue}</div>

        <div className="text-sm text-gray-500">
          {deal.total_meetings} meetings
        </div>
      </CardContent>
    </Card>
  );
}