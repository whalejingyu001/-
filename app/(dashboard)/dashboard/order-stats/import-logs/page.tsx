import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ORDER_IMPORT_SOURCE_LABELS, ORDER_IMPORT_STATUS_LABELS } from "@/lib/enum-labels";
import { assertModuleAccess } from "@/lib/rbac";
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export default async function OrderImportLogsPage() {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "orders");

  const logs = await prisma.orderImportBatch.findMany({
    include: { importedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">导入记录</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/order-stats/import" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            去导入数据
          </Link>
          <Link href="/dashboard/order-stats" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            返回订单监控
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">导入时间</th>
              <th className="px-4 py-3 text-left">文件名</th>
              <th className="px-4 py-3 text-left">来源系统</th>
              <th className="px-4 py-3 text-left">导入人</th>
              <th className="px-4 py-3 text-left">成功条数</th>
              <th className="px-4 py-3 text-left">失败条数</th>
              <th className="px-4 py-3 text-left">状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.createdAt.toLocaleString("zh-CN")}</td>
                <td className="px-4 py-3">{item.fileName}</td>
                <td className="px-4 py-3">{ORDER_IMPORT_SOURCE_LABELS[item.source]}</td>
                <td className="px-4 py-3">{item.importedBy.name}</td>
                <td className="px-4 py-3">{item.successCount}</td>
                <td className="px-4 py-3">{item.failedCount}</td>
                <td className="px-4 py-3">
                  <Badge
                    text={ORDER_IMPORT_STATUS_LABELS[item.status]}
                    variant={item.status === "SUCCESS" ? "success" : item.status === "PARTIAL" ? "warning" : "danger"}
                  />
                </td>
              </tr>
            ))}
            {logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  暂无导入记录
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

