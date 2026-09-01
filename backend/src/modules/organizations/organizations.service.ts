import { NotFoundError } from "../../utils/errors";
import { recordAuditLog } from "../audit/audit.service";
import * as organizationsRepository from "./organizations.repository";
import type { UpdateOrganizationInput } from "./organizations.schemas";

export async function getMyOrganization(organizationId: string) {
  const organization = await organizationsRepository.getOrganizationById(organizationId);
  if (!organization) throw new NotFoundError("Organization not found");
  return organization;
}

export async function updateMyOrganization(
  organizationId: string,
  userId: string,
  input: UpdateOrganizationInput,
) {
  const existing = await organizationsRepository.getOrganizationById(organizationId);
  if (!existing) throw new NotFoundError("Organization not found");

  const updated = await organizationsRepository.updateOrganization(organizationId, input);

  await recordAuditLog({
    organizationId,
    userId,
    action: "organization.updated",
    entityType: "Organization",
    entityId: organizationId,
    metadata: input,
  });

  return updated;
}
