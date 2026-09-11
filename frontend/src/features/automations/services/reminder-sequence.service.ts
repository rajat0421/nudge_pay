import { api } from "@/lib/api";
import type { ReminderSequence } from "@/types/automation";

export function listSequences(): Promise<ReminderSequence[]> {
  return api.get<ReminderSequence[]>("/reminder-sequences");
}

export function getSequence(id: string): Promise<ReminderSequence> {
  return api.get<ReminderSequence>(`/reminder-sequences/${id}`);
}

export interface CreateSequenceStepInput {
  delayDays: number;
  subject: string;
  body: string;
}

export interface CreateSequenceInput {
  name: string;
  description?: string | undefined;
  isActive?: boolean;
  steps: CreateSequenceStepInput[];
}

export function createSequence(input: CreateSequenceInput): Promise<ReminderSequence> {
  return api.post<ReminderSequence>("/reminder-sequences", input);
}

export interface UpdateSequenceInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export function updateSequence(id: string, input: UpdateSequenceInput): Promise<ReminderSequence> {
  return api.patch<ReminderSequence>(`/reminder-sequences/${id}`, input);
}

export function deleteSequence(id: string): Promise<void> {
  return api.del<void>(`/reminder-sequences/${id}`);
}

export interface UpdateStepInput {
  delayDays?: number;
  subject?: string;
  body?: string;
}

export function updateSequenceStep(sequenceId: string, stepId: string, input: UpdateStepInput) {
  return api.patch(`/reminder-sequences/${sequenceId}/steps/${stepId}`, input);
}
