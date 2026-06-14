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

export async function uploadAudio(meetingId: string, audioBlob: Blob): Promise<{ meeting_id: string; status: string }> {
  const formData = new FormData();
  formData.append("audio", audioBlob, `meeting_${meetingId}.webm`);
  const res = await fetch(`${API_BASE}/api/v1/meetings/${meetingId}/upload`, {
    method: "POST",
    body: formData,
  });
  return handleResponse(res);
}

export async function getMeetingIntelligence(meetingId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/meetings/${meetingId}/intelligence`);
  return handleResponse(res);
}

export async function getDealMemory(dealId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/deals/${dealId}/memory`);
  return handleResponse(res);
}

export async function getDealBrief(dealId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/deals/${dealId}/brief`);
  return handleResponse(res);
}

export async function getDealSummary(dealId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/deals/${dealId}/summary`);
  return handleResponse(res);
}
