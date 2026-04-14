import { redirect } from "next/navigation";
import { CheckInGateClient } from "@/components/attendance/check-in-gate-client";
import { getOrCreateAttendanceToken, hasTodayClockIn } from "@/lib/attendance";
import { requireCurrentUser } from "@/lib/current-user";

export default async function AttendanceCheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const attendanceType =
    params.type === "CLOCK_OUT" || params.type === "FIELD_WORK" || params.type === "CLOCK_IN"
      ? params.type
      : "CLOCK_IN";

  const checkedIn = await hasTodayClockIn(user.id);

  if (attendanceType === "CLOCK_IN" && checkedIn) {
    redirect("/dashboard");
  }

  const tokenRecord = await getOrCreateAttendanceToken(user.id);
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const mobileUrl = `${baseUrl}/mobile/attendance?token=${tokenRecord.token}&type=${attendanceType}`;
  const pageTitle =
    attendanceType === "CLOCK_OUT" ? "请完成下班打卡" : attendanceType === "FIELD_WORK" ? "请完成外勤打卡" : "请先完成打卡";
  const pageDesc =
    attendanceType === "CLOCK_OUT"
      ? "请使用手机扫码完成下班打卡。若存在未完成跟进将被拦截。"
      : attendanceType === "FIELD_WORK"
      ? "请使用手机扫码完成外勤打卡并提交定位。"
      : "登录后需先完成上班打卡，成功后将自动进入系统首页。";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6">
      <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>
      <p className="mt-2 text-sm text-slate-600">{pageDesc}</p>
      <div className="mt-6">
        <CheckInGateClient token={tokenRecord.token} mobileUrl={mobileUrl} expiresAt={tokenRecord.expiresAt.toISOString()} />
      </div>
    </div>
  );
}
