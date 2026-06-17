"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDeals, createDeal } from "@/lib/api";
import { Deal } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, Building2, CalendarDays, Plus, Brain, Clock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

function getMemoryStrength(meetings: number): { label: string; color: string; bg: string } {
  if (meetings >= 3) return { label: "Strong Memory", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" };
  if (meetings >= 1) return { label: "Building Context", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" };
  return { label: "Low Context", color: "text-slate-500", bg: "bg-slate-50 border-slate-200" };
}

function getDealHealth(deal: Deal): { label: string; color: string; bg: string; dot: string } {
  const meetings = deal.total_meetings || 0;
  if (meetings >= 4) return { label: "Healthy", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" };
  if (meetings >= 2) return { label: "At Risk", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-500" };
  if (meetings === 1) return { label: "Critical", color: "text-red-600", bg: "bg-red-50 border-red-200", dot: "bg-red-500" };
  return { label: "New", color: "text-slate-500", bg: "bg-slate-50 border-slate-200", dot: "bg-slate-400" };
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "No activity";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const stageBorderColor: Record<string, string> = {
  discovery: "border-l-slate-400",
  qualification: "border-l-violet-400",
  proposal: "border-l-blue-400",
  negotiation: "border-l-amber-400",
  closed_won: "border-l-emerald-500",
  closed_lost: "border-l-red-400",
};

const stageBadgeClass: Record<string, string> = {
  discovery: "bg-slate-100 text-slate-600",
  qualification: "bg-violet-50 text-violet-700",
  proposal: "bg-blue-50 text-blue-700",
  negotiation: "bg-amber-50 text-amber-700",
  closed_won: "bg-emerald-50 text-emerald-700",
  closed_lost: "bg-red-50 text-red-600",
};

function formatCurrency(value?: number, currency = "USD") {
  if (!value) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function CreateDealDialog({ onCreated }: { onCreated: (d: Deal) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", company: "", contact_name: "",
    contact_role: "", deal_value: "", stage: "discovery",
  });

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.company.trim()) return;
    setLoading(true);
    try {
      const deal = await createDeal({
        name: form.name, company: form.company,
        contact_name: form.contact_name || undefined,
        contact_role: form.contact_role || undefined,
        deal_value: form.deal_value ? parseFloat(form.deal_value) : undefined,
        stage: form.stage as Deal["stage"],
      });
      onCreated(deal);
      setOpen(false);
      setForm({ name: "", company: "", contact_name: "", contact_role: "", deal_value: "", stage: "discovery" });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: "default" }), "bg-indigo-600 hover:bg-indigo-700 text-white gap-2")}>
          <Plus className="h-4 w-4" /> New Deal
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a New Deal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Deal Name *</Label>
              <Input placeholder="Enterprise Platform Deal" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Company *</Label>
              <Input placeholder="Acme Corp" value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Contact Name</Label>
              <Input placeholder="Jane Smith" value={form.contact_name}
                onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Contact Role</Label>
              <Input placeholder="VP of Sales" value={form.contact_role}
                onChange={(e) => setForm((f) => ({ ...f, contact_role: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Deal Value (USD)</Label>
              <Input type="number" placeholder="120000" value={form.deal_value}
                onChange={(e) => setForm((f) => ({ ...f, deal_value: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Stage</Label>
              <Select value={form.stage} onValueChange={(v) => v && setForm((f) => ({ ...f, stage: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["discovery", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"].map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={loading || !form.name || !form.company}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
            {loading ? "Creating..." : "Create Deal"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getDeals().then(setDeals).finally(() => setLoading(false));
  }, []);

  const activeDeals = deals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost");
  const totalMeetings = deals.reduce((sum, d) => sum + (d.total_meetings || 0), 0);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Deals</h1>
          <p className="text-slate-500 text-sm mt-1">
            AI-powered sales memory that compounds across every meeting
          </p>
        </div>
        <CreateDealDialog onCreated={(d) => setDeals((prev) => [d, ...prev])} />
      </div>

      {/* Stats Bar */}
      {!loading && deals.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Deals", value: deals.length, icon: Building2, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Active Deals", value: activeDeals.length, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Total Meetings", value: totalMeetings, icon: CalendarDays, color: "text-amber-600", bg: "bg-amber-50" },
          ].map((stat) => (
            <div key={stat.label} className="glass-surface p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deal Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : deals.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl bg-white/40 backdrop-blur-sm">
          <div className="p-3 bg-indigo-50 rounded-full w-fit mx-auto mb-4">
            <Building2 className="h-6 w-6 text-indigo-500" />
          </div>
          <p className="text-slate-700 font-medium">No deals yet</p>
          <p className="text-slate-400 text-sm mt-1">Create your first deal to start building sales memory</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((deal) => {
            const memory = getMemoryStrength(deal.total_meetings || 0);
            const health = getDealHealth(deal);
            return (
              <div
                key={deal.id}
                onClick={() => router.push(`/deals/${deal.id}`)}
                className={`
                  bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-xl p-5
                  hover:shadow-lg hover:border-slate-300/80 cursor-pointer transition-all duration-200
                  ${stageBorderColor[deal.stage] || "border-l-slate-300"}
                `}
                style={{
                  boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)",
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 truncate">{deal.company}</p>
                    <p className="text-sm text-slate-500 truncate mt-0.5">{deal.name}</p>
                  </div>
                  <Badge className={`ml-2 shrink-0 text-xs ${stageBadgeClass[deal.stage] || "bg-slate-100 text-slate-600"}`}>
                    {deal.stage.replace(/_/g, " ")}
                  </Badge>
                </div>

                {/* Deal Health + Memory Strength */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${health.bg}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
                    <span className={health.color}>{health.label}</span>
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${memory.bg}`}>
                    <Brain className={`h-3 w-3 ${memory.color}`} />
                    <span className={memory.color}>{memory.label}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                  <span className="text-lg font-bold text-slate-800">
                    {formatCurrency(deal.deal_value, deal.currency) || "—"}
                  </span>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {deal.total_meetings || 0} {(deal.total_meetings || 0) === 1 ? "meeting" : "meetings"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(deal.updated_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
