import Link from "next/link";
import { CustomerPriority, CustomerStage, RoleName } from "@prisma/client";
import { createCustomerAction } from "@/app/actions/customer-actions";
import { Badge } from "@/components/ui/badge";
import { assertModuleAccess } from "@/lib/rbac";
import { CUSTOMER_PRIORITY_LABELS, CUSTOMER_STAGE_LABELS } from "@/lib/enum-labels";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds, ownerScope } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

const priorityOptions: CustomerPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const stageFilterOptions: Array<{ label: string; value: "" | CustomerStage }> = [
  { label: "全部阶段", value: "" },
  { label: "新客户", value: "NEW" },
  { label: "已联系", value: "CONTACTED" },
  { label: "跟进中", value: "FOLLOWING" },
  { label: "已成交", value: "WON" },
];

type FollowStatusFilter = "" | "TODAY" | "OVERDUE";
type OwnerFilter = "MINE" | "ALL";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    keyword?: string;
    stage?: string;
    followStatus?: string;
    priority?: string;
    owner?: string;
  }>;
}) {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "customers");
  const params = await searchParams;

  const keyword = (params.keyword ?? "").trim();
  const stage = (params.stage ?? "") as "" | CustomerStage;
  const followStatus = (params.followStatus ?? "") as FollowStatusFilter;
  const priority = (params.priority ?? "") as "" | CustomerPriority;
  const ownerFilter = (params.owner ?? "MINE") as OwnerFilter;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const ownerIds = await getAccessibleOwnerIds(user);
  const ownerWhere =
    user.role === "ADMIN" && ownerFilter === "ALL"
      ? {}
      : ownerFilter === "MINE"
      ? { ownerId: user.id }
      : ownerScope(ownerIds);
  const [customers, salesUsers] = await Promise.all([
    prisma.customer.findMany({
      where: {
        ...ownerWhere,
        ...(keyword
          ? {
              OR: [
                { name: { contains: keyword, mode: "insensitive" } },
                { companyName: { contains: keyword, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(stage ? { stage } : {}),
        ...(priority ? { priority } : {}),
        ...(followStatus === "TODAY"
          ? {
              nextFollowUpAt: { gte: startOfToday, lt: startOfTomorrow },
              followUps: { some: { status: "PENDING" } },
            }
          : followStatus === "OVERDUE"
          ? {
              nextFollowUpAt: { lt: startOfToday },
              followUps: { some: { status: "PENDING" } },
            }
          : {}),
      },
      include: { owner: { select: { name: true } } },
      orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "desc" }],
    }),
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: { name: { in: [RoleName.SALES, RoleName.SALES_MANAGER] } },
      },
      select: { id: true, name: true, role: { select: { name: true, label: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const defaultOwnerId =
    user.role === "SALES" ? user.id : salesUsers.find((item) => item.role.name === "SALES")?.id ?? salesUsers[0]?.id ?? "";

  const sortedCustomers = [...customers].sort((a, b) => {
    const bucket = (date: Date | null) => {
      if (!date) return 2;
      if (date < startOfToday) return 0;
      if (date >= startOfToday && date < startOfTomorrow) return 1;
      return 2;
    };
    const bucketA = bucket(a.nextFollowUpAt);
    const bucketB = bucket(b.nextFollowUpAt);
    if (bucketA !== bucketB) return bucketA - bucketB;
    const timeA = a.nextFollowUpAt ? a.nextFollowUpAt.getTime() : Number.MAX_SAFE_INTEGER;
    const timeB = b.nextFollowUpAt ? b.nextFollowUpAt.getTime() : Number.MAX_SAFE_INTEGER;
    return timeA - timeB;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">客户中心</h1>

      <form action={createCustomerAction} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <h2 className="md:col-span-3 text-sm font-semibold text-slate-900">基础信息</h2>
          <input name="name" placeholder="姓名" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
          <input name="companyName" placeholder="公司名" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="title" placeholder="联系人职位" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <h2 className="md:col-span-2 text-sm font-semibold text-slate-900">联系方式</h2>
          <input name="phone" placeholder="电话" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input name="wechat" placeholder="微信" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <h2 className="md:col-span-3 text-sm font-semibold text-slate-900">归属与业务属性</h2>
          <select
            name="ownerId"
            defaultValue={defaultOwnerId}
            disabled={user.role === "SALES"}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            required
          >
            {salesUsers.map((sales) => (
              <option key={sales.id} value={sales.id}>
                {sales.name}（{sales.role.label}）
              </option>
            ))}
          </select>
          {user.role === "SALES" ? <input type="hidden" name="ownerId" value={user.id} /> : null}

          <select name="priority" defaultValue="MEDIUM" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required>
            {priorityOptions.map((item) => (
              <option key={item} value={item}>
                {CUSTOMER_PRIORITY_LABELS[item]}
              </option>
            ))}
          </select>

          <input name="unitProfit" type="number" step="0.01" placeholder="每单利润" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />

          <div className="md:col-span-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">业务需求（多选）</p>
            <div className="mt-2 flex gap-4 text-sm text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" name="businessNeeds" value="海外仓" className="h-4 w-4" />
                海外仓
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" name="businessNeeds" value="机构" className="h-4 w-4" />
                机构
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <h2 className="text-sm font-semibold text-slate-900">备注</h2>
          <textarea name="notes" placeholder="客户补充备注" className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <div className="flex justify-end">
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">保存客户</button>
        </div>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <form method="get" className="grid grid-cols-1 gap-3 border-b border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
          <input
            name="keyword"
            defaultValue={keyword}
            placeholder="搜索客户姓名 / 公司名"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <select name="stage" defaultValue={stage} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            {stageFilterOptions.map((item) => (
              <option key={item.label} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select name="followStatus" defaultValue={followStatus} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">全部跟进状态</option>
            <option value="TODAY">今日待跟进</option>
            <option value="OVERDUE">未完成跟进</option>
          </select>
          <select name="priority" defaultValue={priority} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">全部优先级</option>
            <option value="HIGH">高</option>
            <option value="MEDIUM">中</option>
            <option value="LOW">低</option>
          </select>
          {user.role === "ADMIN" ? (
            <select name="owner" defaultValue={ownerFilter} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="MINE">我的客户</option>
              <option value="ALL">全部客户</option>
            </select>
          ) : (
            <input type="hidden" name="owner" value="MINE" />
          )}
          <div className="md:col-span-5 flex justify-end gap-2">
            <Link href="/dashboard/customers" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
              重置
            </Link>
            <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
              筛选
            </button>
          </div>
        </form>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">客户姓名</th>
              <th className="px-4 py-3 text-left">公司名</th>
              <th className="px-4 py-3 text-left">开户人</th>
              <th className="px-4 py-3 text-left">当前阶段</th>
              <th className="px-4 py-3 text-left">优先级</th>
              <th className="px-4 py-3 text-left">每单利润</th>
              <th className="px-4 py-3 text-left">下一次跟进时间</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedCustomers.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.name}</td>
                <td className="px-4 py-3">{item.companyName ?? "-"}</td>
                <td className="px-4 py-3">{item.owner.name}</td>
                <td className="px-4 py-3">{CUSTOMER_STAGE_LABELS[item.stage]}</td>
                <td className="px-4 py-3">
                  <Badge text={CUSTOMER_PRIORITY_LABELS[item.priority]} variant={item.priority === "CRITICAL" ? "danger" : "info"} />
                </td>
                <td className="px-4 py-3">¥{Number(item.unitProfit).toFixed(2)}</td>
                <td className="px-4 py-3">{item.nextFollowUpAt ? item.nextFollowUpAt.toLocaleString("zh-CN") : "-"}</td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/customers/${item.id}`} className="text-slate-900 underline">
                    查看详情
                  </Link>
                </td>
              </tr>
            ))}
            {sortedCustomers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  没有符合条件的客户
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
