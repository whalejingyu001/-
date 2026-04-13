import { redirect } from "next/navigation";
import { CheckInGateClient } from "@/components/attendance/check-in-gate-client";
import { getOrCreateAttendanceToken, hasTodayClockIn } from "@/lib/attendance";
import { requireCurrentUser } from "@/lib/current-user";

export default async function AttendanceCheckInPage() {
  const user = await requireCurrentUser();
  const checkedIn = await hasTodayClockIn(user.id);

  if (checkedIn) {
    redirect("/dashboard");
  }

  const tokenRecord = await getOrCreateAttendanceToken(user.id);
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const mobileUrl = `${baseUrl}/mobile/attendance?token=${tokenRecord.token}`;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6">
      <h1 className="text-2xl font-bold text-slate-900">请先完成打卡</h1>
      <p className="mt-2 text-sm text-slate-600">登录后需先完成上班打卡，成功后将自动进入系统首页。</p>
      <div className="mt-6">
        <CheckInGateClient token={tokenRecord.token} mobileUrl={mobileUrl} expiresAt={tokenRecord.expiresAt.toISOString()} />
      </div>
    </div>
  );
}

