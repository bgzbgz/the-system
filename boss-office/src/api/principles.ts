/**
 * Principles API Client
 *
 * Fetches Fast Track principle documents from the backend.
 */

import { api } from './client.ts';

export interface PrincipleDocument {
  id: string;
  filename: string;
  title: string;
  size: number;
  category: string;
}

export interface PrincipleContent {
  id: string;
  filename: string;
  title: string;
  content: string;
}

/**
 * Fetch all principle documents
 */
export async function getPrinciples(): Promise<PrincipleDocument[]> {
  const response = await api.get<{ success: boolean; data: PrincipleDocument[] }>('/principles');
  return response.data;
}

/**
 * Fetch a specific principle document content
 */
export async function getPrincipleContent(id: string): Promise<PrincipleContent> {
  const response = await api.get<{ success: boolean; data: PrincipleContent }>(`/principles/${id}`);
  return response.data;
}
