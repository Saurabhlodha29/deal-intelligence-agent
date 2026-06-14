"use client";

import { useEffect, useState } from "react";
import { Deal } from "@/lib/types";
import { getDeals } from "@/lib/api";
import DealCard from "@/components/deals/DealCard";
import CreateDealModal from "@/components/deals/CreateDealModal";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const data = await getDeals();
        setDeals(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };
    fetchDeals();
  }, []);

  const handleDealCreated = (newDeal: Deal) => {
    setDeals((prev) => [newDeal, ...prev]);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Deal Intelligence Agent</h1>
      <CreateDealModal onCreated={handleDealCreated} />
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            onClick={() => (window.location.href = `/deals/${deal.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
