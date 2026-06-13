import { Deal, Meeting, ProcessingStatus } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function handleResponse(res: Response) {
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function getDeals(): Promise<Deal[]> {
  const res = await fetch(`${API_BASE}/api/v1/deals/`);
  return handleResponse(res);
}

export async function getDeal(dealId: string): Promise<Deal> {
  const res = await fetch(`${API_BASE}/api/v1/deals/${dealId}`);
  return handleResponse(res);
}

export async function createDeal(data: Partial<Deal>): Promise<Deal> {
  const res = await fetch(`${API_BASE}/api/v1/deals/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function updateDeal(dealId: string, data: Partial<Deal>): Promise<Deal> {
  const res = await fetch(`${API_BASE}/api/v1/deals/${dealId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function deleteDeal(dealId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/deals/${dealId}`, {
    method: "DELETE",
  });
  await handleResponse(res);
}

export async function getMeetings(dealId: string): Promise<Meeting[]> {
  const res = await fetch(`${API_BASE}/api/v1/deals/${dealId}/meetings`);
  return handleResponse(res);
}

export async function getMeeting(meetingId: string): Promise<Meeting> {
  const res = await fetch(`${API_BASE}/api/v1/meetings/${meetingId}`);
  return handleResponse(res);
}

export async function createMeeting(dealId: string, data: { title?: string }): Promise<Meeting> {
  const res = await fetch(`${API_BASE}/api/v1/deals/${dealId}/meetings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function getMeetingStatus(meetingId: string): Promise<ProcessingStatus> {
  const res = await fetch(`${API_BASE}/api/v1/meetings/${meetingId}/status`);
  return handleResponse(res);
}
