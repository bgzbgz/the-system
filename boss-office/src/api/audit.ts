import { api } from './client.ts';
import type { AuditEvent, AuditEventsResponse } from '../types/index.ts';

// List audit events with optional job filter
export async function listAuditEvents(jobId?: string): Promise<AuditEvent[]> {
  const endpoint = jobId ? `/audit?jobId=${jobId}` : '/audit';
  const response = await api.get<AuditEventsResponse>(endpoint);
  return response.events;
}

// Export as named export
export const auditApi = {
  list: listAuditEvents,
};
