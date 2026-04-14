import Link from "next/link";
import { OrderImportUploader } from "@/components/order-import/order-import-uploader";
import { assertModuleAccess } from "@/lib/rbac";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds, ownerScope } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

export default async function OrderImportPage() {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "orders");

  const ownerIds = await getAccessibleOwnerIds(user);
  const customers = await prisma.customer.findMany({
    where: ownerScope(ownerIds),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">订单数据导入</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/order-stats" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            返回订单监控
          </Link>
          <Link href="/dashboard/order-stats/import-logs" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            查看导入记录
          </Link>
        </div>
      </div>

      <OrderImportUploader customers={customers} />
    </div>
  );
}

