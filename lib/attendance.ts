import { endOfDay, startOfDay } from "date-fns";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

const ATTENDANCE_TOKEN_MINUTES = 10;

export async function hasTodayClockIn(userId: string) {
  const now = new Date();
  const count = await prisma.attendanceRecord.count({
    where: {
      userId,
      type: "CLOCK_IN",
      checkedAt: {
        gte: startOfDay(now),
        lte: endOfDay(now),
      },
    },
  });
  return count > 0;
}

export async function getOrCreateAttendanceToken(userId: string) {
  const now = new Date();

  await prisma.attendanceQrToken.updateMany({
    where: {
      userId,
      status: "PENDING",
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  const existing = await prisma.attendanceQrToken.findFirst({
    where: {
      userId,
      purpose: "attendance",
      status: "PENDING",
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.attendanceQrToken.create({
    data: {
      userId,
      purpose: "attendance",
      token: randomUUID(),
      expiresAt: new Date(now.getTime() + ATTENDANCE_TOKEN_MINUTES * 60 * 1000),
    },
  });
}

