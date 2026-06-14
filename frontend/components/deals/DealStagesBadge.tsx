"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";

interface Props {
  stage: string;
}

const stageColors: Record<string, string> = {
  discovery: "bg-gray-200 text-gray-800",
  qualification: "bg-indigo-200 text-indigo-800",
  proposal: "bg-blue-200 text-blue-800",
  negotiation: "bg-yellow-200 text-yellow-800",
  closed_won: "bg-green-200 text-green-800",
  closed_lost: "bg-red-200 text-red-800",
};

export default function DealStagesBadge({ stage }: Props) {
  return (
    <Badge className={stageColors[stage] || "bg-gray-200 text-gray-800"}>
      {stage.replace(/_/g, " ")}
    </Badge>
  );
}
