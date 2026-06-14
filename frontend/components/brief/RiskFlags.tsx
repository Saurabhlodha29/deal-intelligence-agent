"use client";

import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Risk {
  risk: string;
  severity: string;
  appeared_in_meetings?: number[];
}

interface Props {
  risks: Risk[];
}

const severityColors: Record<string, string> = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-gray-100 text-gray-800 border-gray-200",
};

export default function RiskFlags({ risks }: Props) {
  if (!risks || risks.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risks to Watch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {risks.map((r, i) => (
          <div
            key={i}
            className={`border-l-4 p-3 rounded ${severityColors[r.severity] || severityColors.low}`}
          >
            <p className="font-medium text-sm">{r.risk}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {r.severity}
              </Badge>
              {r.appeared_in_meetings && r.appeared_in_meetings.length > 0 && (
                <span className="text-xs text-gray-500">
                  Meetings #{r.appeared_in_meetings.join(", #")}
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
