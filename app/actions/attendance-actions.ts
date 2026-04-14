"use server";

import { startOfDay } from "date-fns";
import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function checkoutAction() {
  const user = await requireCurrentUser();
  const todayStart = startOfDay(new Date());

  const overdueCustomers = await prisma.customer.count({
    where: {
      ownerId: user.id,
      nextFollowUpAt: { lt: new Date() },
      followUps: {
        some: {
          status: "PENDING",
        },
      },
    },
  });

  if (overdueCustomers > 0) {
    throw new Error("存在未完成跟进，请先处理");
  }

  await prisma.attendanceRecord.upsert({
    where: { userId_attendanceDate_type: { userId: user.id, attendanceDate: todayStart, type: "CLOCK_OUT" } },
    update: {
      checkOutAt: new Date(),
      checkedAt: new Date(),
      status: "CHECKED_OUT",
      note: "正常打卡",
    },
    create: {
      userId: user.id,
      attendanceDate: todayStart,
      type: "CLOCK_OUT",
      checkInAt: todayStart,
      checkOutAt: new Date(),
      checkedAt: new Date(),
      status: "CHECKED_OUT",
      note: "正常打卡",
    },
  });

  revalidatePath("/dashboard/supervision");
}
