"use client";

import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";

interface Strategy {
  strategy: string;
  reasoning: string;
}

interface Props {
  strategies: Strategy[];
}

export default function StrategyCards({ strategies }: Props) {
  if (!strategies || strategies.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommended Strategies</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {strategies.map((s, i) => (
          <div key={i} className="border-l-4 border-green-400 pl-3">
            <p className="font-medium text-sm">{s.strategy}</p>
            {s.reasoning && (
              <p className="text-xs text-gray-500 mt-0.5">{s.reasoning}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
