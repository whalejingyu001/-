import { startOfDay } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const payloadSchema = z.object({
  token: z.string().min(1),
  type: z.enum(["CLOCK_IN", "CLOCK_OUT", "FIELD_WORK"]),
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional(),
  address: z.string().optional(),
  images: z.array(z.string().min(1)).optional(),
  remark: z.string().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "请求参数不合法" }, { status: 400 });
  }

  const { token, type, latitude, longitude, accuracy, address, images, remark } = parsed.data;

  const tokenRecord = await prisma.attendanceQrToken.findUnique({
    where: { token },
  });

  if (!tokenRecord || tokenRecord.purpose !== "attendance") {
    return NextResponse.json({ error: "无效打卡链接" }, { status: 400 });
  }

  if (tokenRecord.status !== "PENDING") {
    return NextResponse.json({ error: "该打卡二维码已失效或已使用" }, { status: 400 });
  }

  if (tokenRecord.expiresAt.getTime() < Date.now()) {
    await prisma.attendanceQrToken.update({
      where: { id: tokenRecord.id },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json({ error: "打卡二维码已过期，请返回电脑端刷新" }, { status: 400 });
  }

  const checkedAt = new Date();
  const attendanceDate = startOfDay(checkedAt);

  if (accuracy != null && accuracy > 100) {
    return NextResponse.json({ error: "定位不准确，请重新获取" }, { status: 400 });
  }

  if (type === "CLOCK_OUT") {
    const pendingFollowUps = await prisma.customer.count({
      where: {
        ownerId: tokenRecord.userId,
        nextFollowUpAt: { lt: checkedAt },
        followUps: { some: { status: "PENDING" } },
      },
    });

    if (pendingFollowUps > 0) {
      return NextResponse.json({ error: "存在未完成跟进，请先处理" }, { status: 400 });
    }
  }

  if (type === "FIELD_WORK") {
    if (!remark || !remark.trim()) {
      return NextResponse.json({ error: "外勤说明必填" }, { status: 400 });
    }
    if (!images || images.length === 0) {
      return NextResponse.json({ error: "外勤打卡必须上传至少 1 张现场照片" }, { status: 400 });
    }

    const latestFieldWork = await prisma.attendanceRecord.findFirst({
      where: { userId: tokenRecord.userId, type: "FIELD_WORK", checkedAt: { not: null } },
      orderBy: { checkedAt: "desc" },
      select: { checkedAt: true },
    });

    if (latestFieldWork?.checkedAt) {
      const diffMs = checkedAt.getTime() - latestFieldWork.checkedAt.getTime();
      if (diffMs < 30 * 60 * 1000) {
        return NextResponse.json({ error: "外勤打卡过于频繁，请稍后再试" }, { status: 400 });
      }
    }
  }

  const fieldWorkNote =
    type === "FIELD_WORK"
      ? JSON.stringify({
          kind: "FIELD_WORK_PROOF",
          remark: remark?.trim() ?? "",
          images: images ?? [],
        })
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.attendanceRecord.upsert({
      where: {
        userId_attendanceDate_type: {
          userId: tokenRecord.userId,
          attendanceDate,
          type,
        },
      },
      update: {
        checkedAt,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        address: address ?? null,
        qrToken: tokenRecord.token,
        tokenExpiredAt: tokenRecord.expiresAt,
        checkInAt: type === "CLOCK_IN" ? checkedAt : undefined,
        checkOutAt: type === "CLOCK_OUT" ? checkedAt : undefined,
        status: type === "CLOCK_OUT" ? "CHECKED_OUT" : "WORKING",
        note: fieldWorkNote ?? undefined,
      },
      create: {
        userId: tokenRecord.userId,
        attendanceDate,
        type,
        checkedAt,
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        address: address ?? null,
        qrToken: tokenRecord.token,
        tokenExpiredAt: tokenRecord.expiresAt,
        checkInAt: type === "CLOCK_IN" ? checkedAt : null,
        checkOutAt: type === "CLOCK_OUT" ? checkedAt : null,
        status: type === "CLOCK_OUT" ? "CHECKED_OUT" : "WORKING",
        note: fieldWorkNote,
      },
    });

    await tx.attendanceQrToken.update({
      where: { id: tokenRecord.id },
      data: { status: "COMPLETED", usedAt: checkedAt },
    });
  });

  return NextResponse.json({ ok: true });
}
