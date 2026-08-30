import { prisma } from "../../db/prisma";

export function getOrganizationById(id: string) {
  return prisma.organization.findUnique({ where: { id } });
}
