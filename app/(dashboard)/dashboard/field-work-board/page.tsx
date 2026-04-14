import { assertModuleAccess } from "@/lib/rbac";
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";

type FieldWorkProof = {
  remark: string;
  images: string[];
};

type FieldWorkRow = {
  id: string;
  userId: string;
  userName: string;
  checkedAt: Date;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  remark: string;
  images: string[];
};

function getChinaTodayRange() {
  const now = new Date();
  const offsetMs = 8 * 60 * 60 * 1000;
  const chinaNow = new Date(now.getTime() + offsetMs);
  const start = new Date(Date.UTC(chinaNow.getUTCFullYear(), chinaNow.getUTCMonth(), chinaNow.getUTCDate()) - offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

function parseFieldWorkProof(note?: string | null): FieldWorkProof {
  if (!note) return { remark: "-", images: [] };
  try {
    const parsed = JSON.parse(note) as { kind?: string; remark?: string; images?: string[] };
    if (parsed.kind !== "FIELD_WORK_PROOF") return { remark: "-", images: [] };
    return {
      remark: parsed.remark?.trim() || "-",
      images: Array.isArray(parsed.images) ? parsed.images : [],
    };
  } catch {
    return { remark: "-", images: [] };
  }
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function detectAnomaly(current: FieldWorkRow, previousByUser?: FieldWorkRow) {
  const tags: Array<{ text: string; variant: "danger" | "warning" }> = [];

  if (current.accuracy != null && current.accuracy > 100) {
    tags.push({ text: "定位异常", variant: "danger" });
  }

  if (previousByUser) {
    const diffMs = current.checkedAt.getTime() - previousByUser.checkedAt.getTime();
    if (diffMs > 0 && diffMs < 30 * 60 * 1000) {
      tags.push({ text: "高频外勤", variant: "warning" });
    }

    if (
      diffMs > 0 &&
      diffMs <= 30 * 60 * 1000 &&
      current.latitude != null &&
      current.longitude != null &&
      previousByUser.latitude != null &&
      previousByUser.longitude != null
    ) {
      const km = distanceKm(current.latitude, current.longitude, previousByUser.latitude, previousByUser.longitude);
      if (km >= 30) {
        tags.push({ text: "位置跨度异常", variant: "danger" });
      }
    }
  }

  return tags;
}

export default async function FieldWorkBoardPage() {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "field-work-board");

  const { start, end } = getChinaTodayRange();
  const rawRecords = await prisma.attendanceRecord.findMany({
    where: {
      type: "FIELD_WORK",
      checkedAt: { gte: start, lte: end },
    },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: [{ checkedAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  const rows: FieldWorkRow[] = rawRecords.map((item) => {
    const proof = parseFieldWorkProof(item.note);
    return {
      id: item.id,
      userId: item.user.id,
      userName: item.user.name,
      checkedAt: item.checkedAt ?? item.createdAt,
      address: item.address,
      latitude: item.latitude,
      longitude: item.longitude,
      accuracy: item.accuracy,
      remark: proof.remark,
      images: proof.images,
    };
  });

  const countByUser = new Map<string, { userId: string; userName: string; count: number }>();
  for (const row of rows) {
    const current = countByUser.get(row.userId);
    if (!current) {
      countByUser.set(row.userId, { userId: row.userId, userName: row.userName, count: 1 });
    } else {
      countByUser.set(row.userId, { ...current, count: current.count + 1 });
    }
  }

  const ranking = Array.from(countByUser.values()).sort((a, b) => b.count - a.count);
  const totalCount = rows.length;
  const totalUsers = ranking.length;
  const avgPerUser = totalUsers > 0 ? (totalCount / totalUsers).toFixed(1) : "0.0";
  const topUser = ranking[0];

  const previousByUser = new Map<string, FieldWorkRow>();
  const anomalyMap = new Map<string, Array<{ text: string; variant: "danger" | "warning" }>>();
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    const previous = previousByUser.get(row.userId);
    anomalyMap.set(row.id, detectAnomaly(row, previous));
    previousByUser.set(row.userId, row);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">外勤监管看板</h1>
        <p className="mt-1 text-sm text-slate-500">
          统计范围：{start.toLocaleDateString("zh-CN")}（今日外勤）
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="今日外勤总次数" value={totalCount} />
        <StatCard title="今日外勤人数" value={totalUsers} />
        <StatCard title="平均每人外勤次数" value={avgPerUser} />
        <StatCard title="外勤次数最多员工" value={topUser ? `${topUser.userName}（${topUser.count}次）` : "-"} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">外勤排行榜（今日）</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">排名</th>
                <th className="px-4 py-3 text-left">员工</th>
                <th className="px-4 py-3 text-left">外勤次数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ranking.map((item, index) => (
                <tr key={item.userId}>
                  <td className="px-4 py-3">#{index + 1}</td>
                  <td className="px-4 py-3">{item.userName}</td>
                  <td className="px-4 py-3">{item.count}</td>
                </tr>
              ))}
              {ranking.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    今日暂无外勤数据
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">外勤明细（今日）</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">员工姓名</th>
                <th className="px-4 py-3 text-left">打卡时间</th>
                <th className="px-4 py-3 text-left">地址</th>
                <th className="px-4 py-3 text-left">经纬度</th>
                <th className="px-4 py-3 text-left">外勤说明</th>
                <th className="px-4 py-3 text-left">照片</th>
                <th className="px-4 py-3 text-left">定位精度</th>
                <th className="px-4 py-3 text-left">异常标记</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const anomalies = anomalyMap.get(row.id) ?? [];
                const coordinateText =
                  row.latitude != null && row.longitude != null
                    ? `${row.latitude.toFixed(6)}, ${row.longitude.toFixed(6)}`
                    : "-";
                const mapHref =
                  row.latitude != null && row.longitude != null
                    ? `https://maps.google.com/?q=${row.latitude},${row.longitude}`
                    : "";

                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3">{row.userName}</td>
                    <td className="px-4 py-3">{row.checkedAt.toLocaleString("zh-CN")}</td>
                    <td className="px-4 py-3">{row.address ?? "-"}</td>
                    <td className="px-4 py-3">
                      {mapHref ? (
                        <a href={mapHref} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                          {coordinateText}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">{row.remark}</td>
                    <td className="px-4 py-3">
                      {row.images.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {row.images.slice(0, 3).map((src, index) => (
                            <a key={`${row.id}-${index}`} href={src} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={src}
                                alt="外勤照片"
                                className="h-12 w-12 rounded border border-slate-200 object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.accuracy != null ? (
                        <span className={row.accuracy > 100 ? "font-medium text-rose-600" : "text-slate-700"}>
                          ±{Math.round(row.accuracy)}m
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {anomalies.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {anomalies.map((item, index) => (
                            <Badge key={`${row.id}-anomaly-${index}`} text={item.text} variant={item.variant} />
                          ))}
                        </div>
                      ) : (
                        <Badge text="正常" variant="success" />
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    今日暂无外勤明细
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

