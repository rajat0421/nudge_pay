import { api } from "@/lib/api";

export interface Organization {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export function getMyOrganization(): Promise<Organization> {
  return api.get<Organization>("/organizations/me");
}

export interface UpdateOrganizationInput {
  name?: string;
  timezone?: string;
  currency?: string;
}

export function updateMyOrganization(input: UpdateOrganizationInput): Promise<Organization> {
  return api.patch<Organization>("/organizations/me", input);
}
