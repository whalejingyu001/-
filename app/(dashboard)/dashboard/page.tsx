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
  const [todayOrders, todayNewCustomersCount, reminders, todayDueCustomers, overdueCustomers, todayNewCustomers] = await Promise.all([
    prisma.customerOrderStat.aggregate({
      where: {
        statDate: { gte: todayStart, lte: todayEnd },
        customer: { ownerId: userId },
      },
      _sum: { orderCount: true },
    }),
    prisma.customer.count({
      where: {
        ownerId: userId,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.followUp.count({ where: { userId, status: "PENDING" } }),
    prisma.customer.findMany({
      where: {
        ownerId: userId,
        nextFollowUpAt: { gte: todayStart, lte: todayEnd },
        followUps: { some: { status: "PENDING" } },
      },
      select: { id: true, name: true, companyName: true, nextFollowUpAt: true },
      orderBy: { nextFollowUpAt: "asc" },
      take: 20,
    }),
    prisma.customer.findMany({
      where: {
        ownerId: userId,
        nextFollowUpAt: { lt: todayStart },
        followUps: { some: { status: "PENDING" } },
      },
      select: { id: true, name: true, companyName: true, nextFollowUpAt: true },
      orderBy: { nextFollowUpAt: "asc" },
      take: 20,
    }),
    prisma.customer.findMany({
      where: {
        ownerId: userId,
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      select: { id: true, name: true, companyName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">销售今日工作台</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="今日订单量" value={todayOrders._sum.orderCount ?? 0} />
        <StatCard title="今日新增客户" value={todayNewCustomersCount} />
        <StatCard title="未完成跟进数" value={reminders} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">今日待跟进</h2>
          <div className="space-y-2 text-sm">
            {todayDueCustomers.length === 0 ? <p className="text-slate-500">今日暂无待跟进客户</p> : null}
            {todayDueCustomers.map((item) => (
              <Link key={item.id} href={`/dashboard/customers/${item.id}`} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2 hover:bg-slate-100">
                <div>
                  <p className="font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.companyName ?? "-"}</p>
                </div>
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
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-rose-500">{item.companyName ?? "-"}</p>
                </div>
                <span className="text-xs">逾期 {differenceInCalendarDays(todayStart, item.nextFollowUpAt ?? todayStart)} 天</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">今日新增客户</h2>
          <div className="space-y-2 text-sm">
            {todayNewCustomers.length === 0 ? <p className="text-slate-500">今日暂无新增客户</p> : null}
            {todayNewCustomers.map((item) => (
              <Link key={item.id} href={`/dashboard/customers/${item.id}`} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2 hover:bg-slate-100">
                <div>
                  <p className="font-medium text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.companyName ?? "-"}</p>
                </div>
                <span className="text-xs text-slate-500">{item.createdAt.toLocaleString("zh-CN")}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">快捷操作</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link href="/dashboard/customers" className="rounded-md bg-slate-900 px-4 py-2 text-center text-sm text-white">
              新建客户
            </Link>
            <Link href="/dashboard/customers" className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm text-slate-700 hover:bg-slate-50">
              新增跟进
            </Link>
            <Link href="/dashboard/quotes" className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm text-slate-700 hover:bg-slate-50">
              新增报价
            </Link>
            <Link href="/attendance/check-in?type=CLOCK_OUT" className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm text-slate-700 hover:bg-slate-50">
              下班打卡
            </Link>
            <Link href="/attendance/check-in?type=FIELD_WORK" className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm text-slate-700 hover:bg-slate-50">
              外勤打卡
            </Link>
            <Link href="/dashboard/attendance" className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm text-slate-700 hover:bg-slate-50">
              打卡中心
            </Link>
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
  const now = new Date();
  const today = { gte: startOfDay(now), lte: endOfDay(now) };

  const [customers, salesUsers, todayOrderRows, pendingFollowUps, todayNewCustomers, riskCustomers] = await Promise.all([
    prisma.customer.findMany({
      where: ownerScope(ownerIds),
      select: { id: true, ownerId: true, unitProfit: true, owner: { select: { name: true } } },
    }),
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: { name: "SALES" },
        ...(ownerIds ? { id: { in: ownerIds } } : {}),
      },
      select: { id: true, name: true },
    }),
    prisma.customerOrderStat.findMany({
      where: {
        statDate: today,
        customer: ownerScope(ownerIds),
      },
      select: { customerId: true, orderCount: true },
    }),
    prisma.followUp.count({
      where: {
        status: { not: "DONE" },
        customer: ownerScope(ownerIds),
      },
    }),
    prisma.customer.count({
      where: {
        ...ownerScope(ownerIds),
        createdAt: today,
      },
    }),
    prisma.customer.findMany({
      where: {
        ...ownerScope(ownerIds),
        nextFollowUpAt: { lt: now },
        followUps: { some: { status: { not: "DONE" } } },
      },
      select: {
        id: true,
        name: true,
        companyName: true,
        nextFollowUpAt: true,
        owner: { select: { name: true } },
      },
      orderBy: { nextFollowUpAt: "asc" },
      take: 20,
    }),
  ]);

  const customerById = new Map(customers.map((c) => [c.id, c]));
  const salesById = new Map(salesUsers.map((s) => [s.id, s]));
  const ownerOrderMap = new Map<string, number>();
  const ownerRevenueMap = new Map<string, number>();

  for (const row of todayOrderRows) {
    const customer = customerById.get(row.customerId);
    if (!customer) continue;
    const ownerId = customer.ownerId;
    ownerOrderMap.set(ownerId, (ownerOrderMap.get(ownerId) ?? 0) + row.orderCount);
    ownerRevenueMap.set(ownerId, (ownerRevenueMap.get(ownerId) ?? 0) + row.orderCount * Number(customer.unitProfit));
  }

  const salesRankingBase = salesUsers.map((sales) => ({
    userId: sales.id,
    name: sales.name,
    orderCount: ownerOrderMap.get(sales.id) ?? 0,
    revenue: ownerRevenueMap.get(sales.id) ?? 0,
  }));

  const byOrderRanking = [...salesRankingBase].sort((a, b) => b.orderCount - a.orderCount);
  const byRevenueRanking = [...salesRankingBase].sort((a, b) => b.revenue - a.revenue);

  const customerDistributionRows = await prisma.customer.groupBy({
    by: ["ownerId"],
    _count: { _all: true },
    where: ownerScope(ownerIds),
  });

  const todayDoneRows = await prisma.followUp.groupBy({
    by: ["userId"],
    _count: { _all: true },
    where: {
      status: "DONE",
      completedAt: today,
      ...(ownerIds ? { userId: { in: ownerIds } } : {}),
    },
  });

  const pendingRows = await prisma.followUp.groupBy({
    by: ["userId"],
    _count: { _all: true },
    where: {
      status: { not: "DONE" },
      customer: ownerScope(ownerIds),
      ...(ownerIds ? { userId: { in: ownerIds } } : {}),
    },
  });

  const doneMap = new Map(todayDoneRows.map((row) => [row.userId, row._count._all]));
  const pendingMap = new Map(pendingRows.map((row) => [row.userId, row._count._all]));
  const followExecutionRows = salesUsers
    .map((sales) => ({
      userId: sales.id,
      name: sales.name,
      todayDone: doneMap.get(sales.id) ?? 0,
      pending: pendingMap.get(sales.id) ?? 0,
    }))
    .sort((a, b) => b.todayDone - a.todayDone || a.pending - b.pending);

  const customerDistribution = customerDistributionRows
    .map((row) => ({
      ownerId: row.ownerId,
      name: salesById.get(row.ownerId)?.name ?? "未知销售",
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  const todayTotalOrders = todayOrderRows.reduce((sum, row) => sum + row.orderCount, 0);
  const todayRevenue = todayOrderRows.reduce((sum, row) => {
    const customer = customerById.get(row.customerId);
    return sum + row.orderCount * Number(customer?.unitProfit ?? 0);
  }, 0);

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">销售主管 / 管理员看板</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="今日总订单量" value={todayTotalOrders} />
        <StatCard title="今日总收入" value={currency(todayRevenue)} />
        <StatCard title="未完成跟进总数" value={pendingFollowUps} />
        <StatCard title="今日新增客户数" value={todayNewCustomers} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">销售排行榜（按订单量）</h2>
          <div className="mt-3 space-y-2">
            {byOrderRanking.map((item, index) => (
              <div key={`order-${item.userId}`} className="flex justify-between rounded bg-slate-50 px-3 py-2 text-sm">
                <span>{index + 1}. {item.name}</span>
                <span>{item.orderCount} 单</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">销售排行榜（按收入）</h2>
          <div className="mt-3 space-y-2">
            {byRevenueRanking.map((item, index) => (
              <div key={`revenue-${item.userId}`} className="flex justify-between rounded bg-slate-50 px-3 py-2 text-sm">
                <span>{index + 1}. {item.name}</span>
                <span>{currency(item.revenue)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">跟进执行排行榜</h2>
          <div className="mt-3 space-y-2">
            {followExecutionRows.map((item) => (
              <div key={`follow-${item.userId}`} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2 text-sm">
                <span>{item.name}</span>
                <span className="text-slate-600">今日完成 {item.todayDone} / 未完成 {item.pending}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">客户分布（按销售）</h2>
          <div className="mt-3 space-y-2">
            {customerDistribution.map((item) => (
              <div key={`dist-${item.ownerId}`} className="flex justify-between rounded bg-slate-50 px-3 py-2 text-sm">
                <span>{item.name}</span>
                <span>{item.count} 个客户</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-rose-800">逾期客户（风险）</h2>
        <div className="mt-3 space-y-2">
          {riskCustomers.length === 0 ? <p className="text-sm text-rose-600">当前无逾期风险客户</p> : null}
          {riskCustomers.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/customers/${item.id}`}
              className="flex items-center justify-between rounded bg-white px-3 py-2 text-sm text-rose-800 hover:bg-rose-100"
            >
              <span>
                {item.name}（{item.companyName ?? "-"} / {item.owner.name}）
              </span>
              <span>逾期 {differenceInCalendarDays(now, item.nextFollowUpAt ?? now)} 天</span>
            </Link>
          ))}
        </div>
      </section>

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
