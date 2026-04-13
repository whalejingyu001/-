"use server";

import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

export async function upsertOrderStatAction(formData: FormData) {
  const user = await requireCurrentUser();
  const customerId = String(formData.get("customerId") || "");
  const orderCount = Number(formData.get("orderCount") || 0);

  const ownerIds = await getAccessibleOwnerIds(user);
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      ...(ownerIds ? { ownerId: { in: ownerIds } } : {}),
    },
  });

  if (!customer) {
    throw new Error("无权限记录该客户单量");
  }

  const today = startOfDay(new Date());

  await prisma.customerOrderStat.upsert({
    where: { customerId_statDate: { customerId, statDate: today } },
    update: { orderCount },
    create: { customerId, statDate: today, orderCount },
  });

  revalidatePath("/dashboard/order-stats");
  revalidatePath("/dashboard/revenue");
  revalidatePath("/dashboard");
}
