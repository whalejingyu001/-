import { endOfDay, startOfDay } from "date-fns";
import type { CurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function getAccessibleOwnerIds(user: CurrentUser) {
  if (user.role === "ADMIN" || user.role === "FINANCE") {
    return undefined;
  }

  if (user.role === "SALES") {
    return [user.id];
  }

  const team = await prisma.user.findMany({
    where: { supervisorId: user.id },
    select: { id: true },
  });

  return [user.id, ...team.map((member) => member.id)];
}

export function ownerScope(ownerIds: string[] | undefined) {
  if (!ownerIds) {
    return {};
  }
  return { ownerId: { in: ownerIds } };
}

export function sameDayRange(date = new Date()) {
  return {
    gte: startOfDay(date),
    lte: endOfDay(date),
  };
}
