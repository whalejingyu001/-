import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ done: false, message: "未登录" }, { status: 401 });
  }

  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ done: false, message: "缺少 token" }, { status: 400 });
  }

  const tokenRecord = await prisma.attendanceQrToken.findUnique({
    where: { token },
  });

  if (!tokenRecord || tokenRecord.userId !== session.user.id) {
    return NextResponse.json({ done: false, message: "二维码无效" }, { status: 404 });
  }

  if (tokenRecord.status === "COMPLETED") {
    return NextResponse.json({ done: true, message: "打卡完成" });
  }

  if (tokenRecord.expiresAt.getTime() < Date.now()) {
    if (tokenRecord.status === "PENDING") {
      await prisma.attendanceQrToken.update({
        where: { id: tokenRecord.id },
        data: { status: "EXPIRED" },
      });
    }
    return NextResponse.json({ done: false, message: "二维码已过期，请刷新页面" });
  }

  return NextResponse.json({ done: false, message: "等待手机端打卡..." });
}

