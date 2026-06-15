// components/deals/CreateDealModal.tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createDeal } from "@/lib/api";
import { Deal } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CreateDealModalProps {
  onCreated: (deal: Deal) => void;
}

export default function CreateDealModal({ onCreated }: CreateDealModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    company: "",
    contact_name: "",
    contact_role: "",
    deal_value: "",
    stage: "discovery" as const,
    currency: "USD",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: Partial<Deal> = {
        name: form.name,
        company: form.company,
        contact_name: form.contact_name || undefined,
        contact_role: form.contact_role || undefined,
        deal_value: form.deal_value ? Number(form.deal_value) : undefined,
        stage: form.stage,
        currency: form.currency,
      };
      const newDeal = await createDeal(payload);
      onCreated(newDeal);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants())}>
        New Deal
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" value={form.name} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="company">Company *</Label>
            <Input id="company" name="company" value={form.company} onChange={handleChange} required />
          </div>
          <div>
            <Label htmlFor="contact_name">Contact Name</Label>
            <Input id="contact_name" name="contact_name" value={form.contact_name} onChange={handleChange} />
          </div>
          <div>
            <Label htmlFor="contact_role">Contact Role</Label>
            <Input id="contact_role" name="contact_role" value={form.contact_role} onChange={handleChange} />
          </div>
          <div>
            <Label htmlFor="deal_value">Deal Value</Label>
            <Input id="deal_value" name="deal_value" type="number" value={form.deal_value} onChange={handleChange} />
          </div>
          <div>
            <Label htmlFor="stage">Stage</Label>
            <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as typeof form.stage })}>
              <SelectTrigger>
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discovery">Discovery</SelectItem>
                <SelectItem value="qualification">Qualification</SelectItem>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="negotiation">Negotiation</SelectItem>
                <SelectItem value="closed_won">Closed Won</SelectItem>
                <SelectItem value="closed_lost">Closed Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating…" : "Create Deal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
