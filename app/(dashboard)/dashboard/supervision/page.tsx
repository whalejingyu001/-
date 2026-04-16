import { checkoutAction } from "@/app/actions/attendance-actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { assertModuleAccess } from "@/lib/rbac";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds, ownerScope } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

export default async function SupervisionPage() {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "supervision");

  const ownerIds = await getAccessibleOwnerIds(user);
  const overdueCustomers = await prisma.customer.findMany({
    where: {
      ...ownerScope(ownerIds),
      nextFollowUpAt: { lt: new Date() },
      followUps: { some: { status: "PENDING" } },
    },
    include: { owner: { select: { name: true } } },
    orderBy: { nextFollowUpAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">强制执行 / 监督中心</h1>

      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        <p>未完成跟进提醒：{overdueCustomers.length} 条</p>
        <p className="mt-1">规则：下班打卡前检查，若存在逾期客户则阻止打卡。</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">逾期客户列表</h2>
        <div className="space-y-2 text-sm">
          {overdueCustomers.map((customer) => (
            <div key={customer.id} className="flex justify-between rounded bg-slate-50 px-3 py-2">
              <span>{customer.name}（{customer.owner.name}）</span>
              <span>{customer.nextFollowUpAt?.toLocaleString("zh-CN")}</span>
            </div>
          ))}
        </div>
      </div>

      <form action={checkoutAction} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <SubmitButton pendingText="检查中..." className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
          下班打卡检查
        </SubmitButton>
      </form>
    </div>
  );
}
