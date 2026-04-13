import { differenceInCalendarDays, endOfDay, startOfDay } from "date-fns";
import Link from "next/link";
import { StatCard } from "@/components/ui/stat-card";
import { currency } from "@/lib/utils";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds, ownerScope } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";
import { calculateRevenueByRange, thisMonthRange, thisWeekRange } from "@/lib/revenue";

async function getSalesDashboard(userId: string) {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const [myCustomers, todayOrders, inFollowUp, overdue, won, reminders, todayDueCustomers, overdueCustomers] = await Promise.all([
    prisma.customer.count({ where: { ownerId: userId } }),
    prisma.customerOrderStat.aggregate({
      where: {
        statDate: { gte: todayStart, lte: todayEnd },
        customer: { ownerId: userId },
      },
      _sum: { orderCount: true },
    }),
    prisma.customer.count({ where: { ownerId: userId, stage: { in: ["CONTACTED", "FOLLOWING"] } } }),
    prisma.customer.count({ where: { ownerId: userId, nextFollowUpAt: { lt: todayStart } } }),
    prisma.customer.count({ where: { ownerId: userId, stage: "WON" } }),
    prisma.followUp.count({ where: { userId, status: { in: ["PENDING", "OVERDUE"] } } }),
    prisma.customer.findMany({
      where: { ownerId: userId, nextFollowUpAt: { gte: todayStart, lte: todayEnd } },
      select: { id: true, name: true, nextFollowUpAt: true },
      orderBy: { nextFollowUpAt: "asc" },
      take: 20,
    }),
    prisma.customer.findMany({
      where: {
        ownerId: userId,
        nextFollowUpAt: { lt: todayStart },
        followUps: { some: { status: { in: ["PENDING", "OVERDUE"] } } },
      },
      select: { id: true, name: true, nextFollowUpAt: true },
      orderBy: { nextFollowUpAt: "asc" },
      take: 20,
    }),
  ]);

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">销售首页</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard title="我的客户" value={myCustomers} />
        <StatCard title="今日订单量" value={todayOrders._sum.orderCount ?? 0} />
        <StatCard title="跟进中客户" value={inFollowUp} />
        <StatCard title="逾期未跟进" value={overdue} />
        <StatCard title="已成交客户" value={won} />
        <StatCard title="未完成跟进提醒" value={reminders} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/dashboard/customers" className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
          新建客户入口
        </Link>
        <Link href="/dashboard/supervision" className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
          查看提醒
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">今日待跟进</h2>
          <div className="space-y-2 text-sm">
            {todayDueCustomers.length === 0 ? <p className="text-slate-500">今日暂无待跟进客户</p> : null}
            {todayDueCustomers.map((item) => (
              <Link key={item.id} href={`/dashboard/customers/${item.id}`} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2 hover:bg-slate-100">
                <span>{item.name}</span>
                <span className="text-xs text-slate-500">{item.nextFollowUpAt?.toLocaleString("zh-CN")}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">未完成跟进</h2>
          <div className="space-y-2 text-sm">
            {overdueCustomers.length === 0 ? <p className="text-slate-500">暂无逾期跟进客户</p> : null}
            {overdueCustomers.map((item) => (
              <Link key={item.id} href={`/dashboard/customers/${item.id}`} className="flex items-center justify-between rounded bg-rose-50 px-3 py-2 text-rose-700 hover:bg-rose-100">
                <span>{item.name}</span>
                <span className="text-xs">逾期 {differenceInCalendarDays(todayStart, item.nextFollowUpAt ?? todayStart)} 天</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

async function getFinanceDashboard() {
  const week = thisWeekRange();
  const month = thisMonthRange();

  const [pendingToday, weekAmount, monthAmount, todayRevenue] = await Promise.all([
    prisma.reimbursement.count({ where: { status: "PENDING", createdAt: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) } } }),
    prisma.reimbursement.aggregate({ where: { createdAt: week }, _sum: { amount: true } }),
    prisma.reimbursement.aggregate({ where: { createdAt: month }, _sum: { amount: true } }),
    calculateRevenueByRange(undefined, { gte: startOfDay(new Date()), lte: endOfDay(new Date()) }),
  ]);

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">财务首页</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="今日待审核报销" value={pendingToday} />
        <StatCard title="本周报销金额" value={currency(Number(weekAmount._sum.amount ?? 0))} />
        <StatCard title="本月报销金额" value={currency(Number(monthAmount._sum.amount ?? 0))} />
        <StatCard title="收入统计" value={currency(todayRevenue)} />
      </div>
      <div className="mt-6 flex gap-3">
        <Link href="/dashboard/quotes" className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
          客户报价入口
        </Link>
        <Link href="/dashboard/finance" className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
          报销审核入口
        </Link>
      </div>
    </>
  );
}

async function getAdminDashboard(ownerIds: string[] | undefined) {
  const week = thisWeekRange();
  const month = thisMonthRange();

  const customers = await prisma.customer.findMany({
    where: ownerScope(ownerIds),
    select: { id: true, owner: { select: { name: true } } },
  });
  const customerIds = customers.map((c) => c.id);

  const [todayRevenue, weekRevenue, monthRevenue, totalOrders, pendingFollowUps, rankingStats] = await Promise.all([
    calculateRevenueByRange(customerIds.length ? customerIds : undefined, { gte: startOfDay(new Date()), lte: endOfDay(new Date()) }),
    calculateRevenueByRange(customerIds.length ? customerIds : undefined, week),
    calculateRevenueByRange(customerIds.length ? customerIds : undefined, month),
    prisma.customerOrderStat.aggregate({
      where: { ...(customerIds.length ? { customerId: { in: customerIds } } : {}) },
      _sum: { orderCount: true },
    }),
    prisma.followUp.count({
      where: { status: { in: ["PENDING", "OVERDUE"] }, customer: ownerScope(ownerIds) },
    }),
    prisma.customerOrderStat.groupBy({
      by: ["customerId"],
      _sum: { orderCount: true },
      where: { ...(customerIds.length ? { customerId: { in: customerIds } } : {}) },
      orderBy: { _sum: { orderCount: "desc" } },
      take: 5,
    }),
  ]);

  const ranking = rankingStats.map((row) => {
    const customer = customers.find((c) => c.id === row.customerId);
    return {
      owner: customer?.owner.name ?? "未知",
      order: row._sum.orderCount ?? 0,
    };
  });

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">管理员首页</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard title="今日总收入" value={currency(todayRevenue)} />
        <StatCard title="本周总收入" value={currency(weekRevenue)} />
        <StatCard title="本月总收入" value={currency(monthRevenue)} />
        <StatCard title="总订单量" value={totalOrders._sum.orderCount ?? 0} />
        <StatCard title="团队待处理跟进" value={pendingFollowUps} />
      </div>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">销售排行</h2>
        <div className="mt-3 space-y-2">
          {ranking.map((item, index) => (
            <div key={`${item.owner}-${index}`} className="flex justify-between rounded bg-slate-50 px-3 py-2 text-sm">
              <span>{index + 1}. {item.owner}</span>
              <span>{item.order} 单</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        <Link href="/dashboard/accounts" className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm hover:bg-slate-50">
          <p className="font-semibold text-slate-900">账户与权限</p>
          <p className="mt-1 text-slate-500">管理内部账号、角色分配与状态控制</p>
        </Link>
        <Link href="/dashboard/attendance" className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm hover:bg-slate-50">
          <p className="font-semibold text-slate-900">打卡记录管理</p>
          <p className="mt-1 text-slate-500">按员工、日期、类型查看打卡记录</p>
        </Link>
        <Link href="/dashboard/finance" className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm hover:bg-slate-50">
          <p className="font-semibold text-slate-900">财务中心</p>
          <p className="mt-1 text-slate-500">查看报价与报销审核处理</p>
        </Link>
        <Link href="/dashboard/supervision" className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm hover:bg-slate-50">
          <p className="font-semibold text-slate-900">监督中心</p>
          <p className="mt-1 text-slate-500">检查逾期客户与打卡拦截</p>
        </Link>
        <Link href="/dashboard/system-settings" className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm hover:bg-slate-50">
          <p className="font-semibold text-slate-900">系统设置</p>
          <p className="mt-1 text-slate-500">系统参数与后续扩展入口</p>
        </Link>
      </div>
    </>
  );
}

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const ownerIds = await getAccessibleOwnerIds(user);

  if (user.role === "SALES") {
    return getSalesDashboard(user.id);
  }

  if (user.role === "FINANCE") {
    return getFinanceDashboard();
  }

  return getAdminDashboard(ownerIds);
}
