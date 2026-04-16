import { AttendanceType } from "@prisma/client";
import { assertModuleAccess } from "@/lib/rbac";
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_TYPE_LABELS } from "@/lib/enum-labels";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  userId?: string;
  type?: AttendanceType;
  date?: string;
};

function parseFieldWorkProof(value?: string | null) {
  const fallback = { remark: "-", images: [] as string[] };
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as { kind?: string; remark?: string; images?: string[] };
    if (parsed.kind !== "FIELD_WORK_PROOF") return fallback;
    return {
      remark: parsed.remark?.trim() || "-",
      images: Array.isArray(parsed.images) ? parsed.images : [],
    };
  } catch {
    return fallback;
  }
}

function getDateRange(date?: string) {
  if (!date) return undefined;
  const start = new Date(`${date}T00:00:00`);
  if (Number.isNaN(start.getTime())) return undefined;
  const end = new Date(`${date}T23:59:59.999`);
  return { gte: start, lte: end };
}

export default async function AttendanceDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "attendance");

  const params = await searchParams;
  const dateRange = getDateRange(params.date);
  const selectedType = params.type as AttendanceType | undefined;

  if (user.role === "ADMIN") {
    const [users, records] = await Promise.all([
      prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.attendanceRecord.findMany({
        where: {
          ...(params.userId ? { userId: params.userId } : {}),
          ...(selectedType ? { type: selectedType } : {}),
          ...(dateRange ? { checkedAt: dateRange } : {}),
        },
        include: { user: { select: { name: true } } },
        orderBy: [{ checkedAt: "desc" }, { createdAt: "desc" }],
        take: 200,
      }),
    ]);

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">打卡记录管理</h1>

        <form className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
          <select name="userId" defaultValue={params.userId ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">全部员工</option>
            {users.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <input name="date" type="date" defaultValue={params.date ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />

          <select name="type" defaultValue={params.type ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">全部类型</option>
            <option value="CLOCK_IN">上班打卡</option>
            <option value="CLOCK_OUT">下班打卡</option>
            <option value="FIELD_WORK">外勤打卡</option>
          </select>

          <SubmitButton pendingText="筛选中..." className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
            筛选
          </SubmitButton>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">员工姓名</th>
                <th className="px-4 py-3 text-left">打卡类型</th>
                <th className="px-4 py-3 text-left">打卡时间</th>
                <th className="px-4 py-3 text-left">打卡地址</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-left">外勤说明</th>
                <th className="px-4 py-3 text-left">现场照片</th>
                <th className="px-4 py-3 text-left">经纬度</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((item) => {
                const time = item.checkedAt ?? item.checkInAt ?? item.checkOutAt ?? item.createdAt;
                const proof = parseFieldWorkProof(item.note);
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3">{item.user.name}</td>
                    <td className="px-4 py-3">{ATTENDANCE_TYPE_LABELS[item.type]}</td>
                    <td className="px-4 py-3">{time.toLocaleString("zh-CN")}</td>
                    <td className="px-4 py-3">{item.address ?? "-"}</td>
                    <td className="px-4 py-3">{ATTENDANCE_STATUS_LABELS[item.status]}</td>
                    <td className="px-4 py-3">{proof.remark}</td>
                    <td className="px-4 py-3">
                      {proof.images.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {proof.images.slice(0, 3).map((src, index) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={`${item.id}-${index}`} src={src} alt="外勤现场" className="h-10 w-10 rounded border border-slate-200 object-cover" />
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.latitude != null && item.longitude != null
                        ? `${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}`
                        : "-"}
                    </td>
                  </tr>
                );
              })}
              {records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    暂无符合条件的打卡记录
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const today = getDateRange(new Date().toISOString().slice(0, 10));
  const [todayClockIn, todayClockOut, todayFieldWorkCount, myRecords] = await Promise.all([
    prisma.attendanceRecord.findFirst({
      where: { userId: user.id, type: "CLOCK_IN", ...(today ? { checkedAt: today } : {}) },
      orderBy: { checkedAt: "desc" },
    }),
    prisma.attendanceRecord.findFirst({
      where: { userId: user.id, type: "CLOCK_OUT", ...(today ? { checkedAt: today } : {}) },
      orderBy: { checkedAt: "desc" },
    }),
    prisma.attendanceRecord.count({
      where: { userId: user.id, type: "FIELD_WORK", ...(today ? { checkedAt: today } : {}) },
    }),
    prisma.attendanceRecord.findMany({
      where: { userId: user.id },
      orderBy: [{ checkedAt: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">打卡中心</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">上班打卡</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{todayClockIn ? "已完成" : "未完成"}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">下班打卡</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{todayClockOut ? "已完成" : "未完成"}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">外勤打卡（今日）</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{todayFieldWorkCount} 次</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">快捷操作</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <a href="/attendance/check-in?type=CLOCK_IN" className="rounded-md bg-slate-900 px-4 py-2 text-center text-sm text-white">
            上班打卡
          </a>
          <a href="/attendance/check-in?type=CLOCK_OUT" className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm text-slate-700 hover:bg-slate-50">
            下班打卡
          </a>
          <a href="/attendance/check-in?type=FIELD_WORK" className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm text-slate-700 hover:bg-slate-50">
            外勤打卡
          </a>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">我的打卡记录</h2>
        </div>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">打卡类型</th>
              <th className="px-4 py-3 text-left">打卡时间</th>
              <th className="px-4 py-3 text-left">打卡地址</th>
              <th className="px-4 py-3 text-left">状态</th>
              <th className="px-4 py-3 text-left">外勤说明</th>
              <th className="px-4 py-3 text-left">现场照片</th>
              <th className="px-4 py-3 text-left">经纬度</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {myRecords.map((item) => {
              const time = item.checkedAt ?? item.checkInAt ?? item.checkOutAt ?? item.createdAt;
              const proof = parseFieldWorkProof(item.note);
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3">{ATTENDANCE_TYPE_LABELS[item.type]}</td>
                  <td className="px-4 py-3">{time.toLocaleString("zh-CN")}</td>
                  <td className="px-4 py-3">{item.address ?? "-"}</td>
                  <td className="px-4 py-3">{ATTENDANCE_STATUS_LABELS[item.status]}</td>
                  <td className="px-4 py-3">{proof.remark}</td>
                  <td className="px-4 py-3">
                    {proof.images.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {proof.images.slice(0, 3).map((src, index) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={`${item.id}-${index}`} src={src} alt="外勤现场" className="h-10 w-10 rounded border border-slate-200 object-cover" />
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.latitude != null && item.longitude != null
                      ? `${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}`
                      : "-"}
                  </td>
                </tr>
              );
            })}
            {myRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  暂无打卡记录
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
