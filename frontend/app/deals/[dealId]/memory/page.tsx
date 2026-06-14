"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getDeal } from "@/lib/api";
import MemoryTimeline from "@/components/memory/MemoryTimeline";

export default function MemoryPage() {
  const params = useParams();
  const dealId = params.dealId as string;
  const [dealName, setDealName] = useState("");

  useEffect(() => {
    getDeal(dealId).then((d) => setDealName(`${d.name} — ${d.company}`));
  }, [dealId]);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-4 flex items-center gap-4">
        <Link href={`/deals/${dealId}`}>
          <Button variant="outline" size="sm">← Back to Deal</Button>
        </Link>
        <h1 className="text-2xl font-bold">Memory Timeline</h1>
        {dealName && <span className="text-gray-500 text-sm">{dealName}</span>}
      </div>
      <MemoryTimeline dealId={dealId} />
    </div>
  );
}