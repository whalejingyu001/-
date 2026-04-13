import { upsertOrderStatAction } from "@/app/actions/order-actions";
import { assertModuleAccess } from "@/lib/rbac";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds, ownerScope } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

export default async function OrderStatsPage() {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "orders");

  const ownerIds = await getAccessibleOwnerIds(user);
  const [customers, stats] = await Promise.all([
    prisma.customer.findMany({ where: ownerScope(ownerIds), orderBy: { name: "asc" } }),
    prisma.customerOrderStat.findMany({
      where: { customer: ownerScope(ownerIds) },
      include: { customer: { select: { name: true, owner: { select: { name: true } } } } },
      orderBy: { statDate: "desc" },
      take: 50,
    }),
  ]);

  const totalToday = stats
    .filter((s) => s.statDate.toDateString() === new Date().toDateString())
    .reduce((sum, item) => sum + item.orderCount, 0);

  const totalAll = stats.reduce((sum, item) => sum + item.orderCount, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">订单数量监控</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">今日订单量</p>
          <p className="text-2xl font-semibold text-slate-900">{totalToday}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">累计订单量</p>
          <p className="text-2xl font-semibold text-slate-900">{totalAll}</p>
        </div>
      </div>

      <form action={upsertOrderStatAction} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
        <select name="customerId" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required>
          <option value="">选择客户</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
        <input name="orderCount" type="number" placeholder="今日订单数" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">更新单量</button>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">日期</th>
              <th className="px-4 py-3 text-left">客户</th>
              <th className="px-4 py-3 text-left">归属销售</th>
              <th className="px-4 py-3 text-left">订单量</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stats.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">{row.statDate.toLocaleDateString("zh-CN")}</td>
                <td className="px-4 py-3">{row.customer.name}</td>
                <td className="px-4 py-3">{row.customer.owner.name}</td>
                <td className="px-4 py-3">{row.orderCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
