import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";

export function getOrganizationById(id: string) {
  return prisma.organization.findUnique({ where: { id } });
}

export function updateOrganization(id: string, data: Prisma.OrganizationUpdateInput) {
  return prisma.organization.update({ where: { id }, data });
}
