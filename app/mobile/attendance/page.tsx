import { MobileAttendanceForm } from "@/components/attendance/mobile-attendance-form";
import { prisma } from "@/lib/prisma";

export default async function MobileAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; type?: string }>;
}) {
  const now = new Date();
  const { token, type } = await searchParams;
  const tokenValue = token ?? "";
  const defaultType =
    type === "CLOCK_OUT" || type === "FIELD_WORK" || type === "CLOCK_IN" ? type : "CLOCK_IN";

  if (!tokenValue) {
    return <div className="p-6 text-sm text-rose-600">缺少打卡 token。</div>;
  }

  const tokenRecord = await prisma.attendanceQrToken.findUnique({
    where: { token: tokenValue },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!tokenRecord || tokenRecord.purpose !== "attendance") {
    return <div className="p-6 text-sm text-rose-600">无效打卡链接。</div>;
  }

  if (tokenRecord.status !== "PENDING") {
    return <div className="p-6 text-sm text-rose-600">该打卡二维码已失效或已使用。</div>;
  }

  if (tokenRecord.expiresAt < now) {
    return <div className="p-6 text-sm text-rose-600">该打卡二维码已过期，请返回电脑端刷新。</div>;
  }

  return (
    <MobileAttendanceForm
      token={tokenValue}
      userName={tokenRecord.user.name}
      userEmail={tokenRecord.user.email}
      defaultType={defaultType}
    />
  );
}
