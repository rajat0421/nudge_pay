import { prisma } from "../../db/prisma";

/**
 * Kept separate from auth.repository, which owns credential-related queries
 * (password hash, refresh tokens). Other modules that only need to display a
 * user's name (audit trail, activity feed) should use this instead.
 */
export function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
}
