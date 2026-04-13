"use server";

import { endOfDay, startOfDay } from "date-fns";
import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function checkoutAction() {
  const user = await requireCurrentUser();
  const todayStart = startOfDay(new Date());

  const overdueCustomers = await prisma.customer.count({
    where: {
      ownerId: user.id,
      nextFollowUpAt: { lt: endOfDay(new Date()) },
      followUps: {
        some: {
          status: { in: ["PENDING", "OVERDUE"] },
        },
      },
    },
  });

  await prisma.attendanceRecord.upsert({
    where: { userId_attendanceDate_type: { userId: user.id, attendanceDate: todayStart, type: "CLOCK_OUT" } },
    update: {
      checkOutAt: new Date(),
      checkedAt: new Date(),
      status: overdueCustomers > 0 ? "BLOCKED" : "CHECKED_OUT",
      note: overdueCustomers > 0 ? `存在 ${overdueCustomers} 个逾期客户，禁止打卡` : "正常打卡",
    },
    create: {
      userId: user.id,
      attendanceDate: todayStart,
      type: "CLOCK_OUT",
      checkInAt: todayStart,
      checkOutAt: new Date(),
      checkedAt: new Date(),
      status: overdueCustomers > 0 ? "BLOCKED" : "CHECKED_OUT",
      note: overdueCustomers > 0 ? `存在 ${overdueCustomers} 个逾期客户，禁止打卡` : "正常打卡",
    },
  });

  revalidatePath("/dashboard/supervision");
}
