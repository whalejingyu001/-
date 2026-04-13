import { endOfDay, startOfDay } from "date-fns";
import { StatCard } from "@/components/ui/stat-card";
import { assertModuleAccess } from "@/lib/rbac";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds, ownerScope } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";
import { calculateRevenueByRange, thisMonthRange, thisWeekRange } from "@/lib/revenue";
import { currency } from "@/lib/utils";

export default async function RevenuePage() {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "revenue");

  const ownerIds = await getAccessibleOwnerIds(user);
  const customers = await prisma.customer.findMany({
    where: ownerScope(ownerIds),
    select: { id: true, name: true, owner: { select: { name: true } }, unitProfit: true },
  });
  const customerIds = customers.map((c) => c.id);

  const [todayRevenue, weekRevenue, monthRevenue, stats] = await Promise.all([
    calculateRevenueByRange(customerIds.length ? customerIds : undefined, { gte: startOfDay(new Date()), lte: endOfDay(new Date()) }),
    calculateRevenueByRange(customerIds.length ? customerIds : undefined, thisWeekRange()),
    calculateRevenueByRange(customerIds.length ? customerIds : undefined, thisMonthRange()),
    prisma.customerOrderStat.findMany({
      where: { ...(customerIds.length ? { customerId: { in: customerIds } } : {}) },
      include: { customer: { select: { name: true, unitProfit: true, owner: { select: { name: true } } } } },
      orderBy: { statDate: "desc" },
      take: 50,
    }),
  ]);

  const salesMap = new Map<string, number>();
  for (const item of stats) {
    const ownerName = item.customer.owner.name;
    const revenue = item.orderCount * Number(item.customer.unitProfit);
    salesMap.set(ownerName, (salesMap.get(ownerName) ?? 0) + revenue);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">收入统计</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="今日收入" value={currency(todayRevenue)} />
        <StatCard title="本周收入" value={currency(weekRevenue)} />
        <StatCard title="本月收入" value={currency(monthRevenue)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">销售维度统计</h2>
          <div className="space-y-2 text-sm">
            {Array.from(salesMap.entries()).map(([name, value]) => (
              <div key={name} className="flex justify-between rounded bg-slate-50 px-3 py-2">
                <span>{name}</span>
                <span>{currency(value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">客户贡献明细</h2>
          <div className="space-y-2 text-sm">
            {stats.slice(0, 10).map((item) => (
              <div key={item.id} className="flex justify-between rounded bg-slate-50 px-3 py-2">
                <span>{item.customer.name}</span>
                <span>{currency(item.orderCount * Number(item.customer.unitProfit))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
