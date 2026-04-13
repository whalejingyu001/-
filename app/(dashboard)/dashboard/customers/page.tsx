import Link from "next/link";
import { CustomerPriority, RoleName } from "@prisma/client";
import { createCustomerAction } from "@/app/actions/customer-actions";
import { Badge } from "@/components/ui/badge";
import { assertModuleAccess } from "@/lib/rbac";
import { CUSTOMER_PRIORITY_LABELS, CUSTOMER_STAGE_LABELS } from "@/lib/enum-labels";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds, ownerScope } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

const priorityOptions: CustomerPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default async function CustomersPage() {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "customers");

  const ownerIds = await getAccessibleOwnerIds(user);
  const [customers, salesUsers] = await Promise.all([
    prisma.customer.findMany({
      where: ownerScope(ownerIds),
      include: { owner: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
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
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">客户姓名</th>
              <th className="px-4 py-3 text-left">公司名</th>
              <th className="px-4 py-3 text-left">开户人</th>
              <th className="px-4 py-3 text-left">当前阶段</th>
              <th className="px-4 py-3 text-left">优先级</th>
              <th className="px-4 py-3 text-left">每单利润</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.name}</td>
                <td className="px-4 py-3">{item.companyName ?? "-"}</td>
                <td className="px-4 py-3">{item.owner.name}</td>
                <td className="px-4 py-3">{CUSTOMER_STAGE_LABELS[item.stage]}</td>
                <td className="px-4 py-3">
                  <Badge text={CUSTOMER_PRIORITY_LABELS[item.priority]} variant={item.priority === "CRITICAL" ? "danger" : "info"} />
                </td>
                <td className="px-4 py-3">¥{Number(item.unitProfit).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/customers/${item.id}`} className="text-slate-900 underline">
                    查看详情
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
