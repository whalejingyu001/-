import { createReimbursementAction, reviewReimbursementAction } from "@/app/actions/reimbursement-actions";
import { assertModuleAccess } from "@/lib/rbac";
import { REIMBURSEMENT_STATUS_LABELS } from "@/lib/enum-labels";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

export default async function FinancePage() {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "finance");

  const ownerIds = await getAccessibleOwnerIds(user);
  const [quotes, reimbursements] = await Promise.all([
    prisma.quote.findMany({
      where: { customer: ownerIds ? { ownerId: { in: ownerIds } } : {} },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.reimbursement.findMany({
      where: user.role === "SALES" ? { applicantId: user.id } : {},
      include: { applicant: { select: { name: true } }, reviewer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">财务中心</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <form action={createReimbursementAction} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">报销申请</h2>
          <input name="amount" type="number" step="0.01" placeholder="金额" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
          <input name="reason" placeholder="报销原因" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">提交申请</button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">客户最新报价</h2>
          <div className="space-y-2 text-sm">
            {quotes.map((quote) => (
              <div key={quote.id} className="flex justify-between rounded bg-slate-50 px-3 py-2">
                <span>{quote.customer.name} V{quote.version}</span>
                <span>¥{Number(quote.totalAmount).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">申请人</th>
              <th className="px-4 py-3 text-left">金额</th>
              <th className="px-4 py-3 text-left">原因</th>
              <th className="px-4 py-3 text-left">状态</th>
              <th className="px-4 py-3 text-left">审核</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reimbursements.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">{row.applicant.name}</td>
                <td className="px-4 py-3">¥{Number(row.amount).toFixed(2)}</td>
                <td className="px-4 py-3">{row.reason}</td>
                <td className="px-4 py-3">{REIMBURSEMENT_STATUS_LABELS[row.status]}</td>
                <td className="px-4 py-3">
                  {(user.role === "FINANCE" || user.role === "ADMIN") && row.status === "PENDING" ? (
                    <form action={reviewReimbursementAction} className="flex gap-2">
                      <input type="hidden" name="id" value={row.id} />
                      <button name="status" value="APPROVED" className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700">
                        通过
                      </button>
                      <button name="status" value="REJECTED" className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700">
                        驳回
                      </button>
                    </form>
                  ) : (
                    row.reviewer?.name ?? "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
