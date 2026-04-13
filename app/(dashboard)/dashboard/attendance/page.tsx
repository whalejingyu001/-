import { AttendanceType } from "@prisma/client";
import { assertAdmin } from "@/lib/admin-guard";
import { assertModuleAccess } from "@/lib/rbac";
import { ATTENDANCE_TYPE_LABELS } from "@/lib/enum-labels";
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  userId?: string;
  type?: AttendanceType;
  date?: string;
};

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
  assertAdmin(user);

  const params = await searchParams;
  const dateRange = getDateRange(params.date);
  const selectedType = params.type;

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

        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">筛选</button>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">员工姓名</th>
              <th className="px-4 py-3 text-left">打卡类型</th>
              <th className="px-4 py-3 text-left">打卡时间</th>
              <th className="px-4 py-3 text-left">打卡地址</th>
              <th className="px-4 py-3 text-left">经纬度</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((item) => {
              const time = item.checkedAt ?? item.checkInAt ?? item.checkOutAt ?? item.createdAt;
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.user.name}</td>
                  <td className="px-4 py-3">{ATTENDANCE_TYPE_LABELS[item.type]}</td>
                  <td className="px-4 py-3">{time.toLocaleString("zh-CN")}</td>
                  <td className="px-4 py-3">{item.address ?? "-"}</td>
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
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
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

