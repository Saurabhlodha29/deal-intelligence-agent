"use client";

import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";

interface Props {
  transcript: string;
}

export default function TranscriptViewer({ transcript }: Props) {
  if (!transcript) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 text-sm italic">No transcript available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transcript</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap">
          {transcript}
        </div>
      </CardContent>
    </Card>
  );
}
