import { createQuoteAction } from "@/app/actions/quote-actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { assertModuleAccess } from "@/lib/rbac";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds, ownerScope } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

export default async function QuotesPage() {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "quotes");

  const ownerIds = await getAccessibleOwnerIds(user);
  const [customers, quotes] = await Promise.all([
    prisma.customer.findMany({ where: ownerScope(ownerIds), orderBy: { name: "asc" } }),
    prisma.quote.findMany({
      where: { customer: ownerScope(ownerIds) },
      include: { customer: { select: { name: true } } },
      orderBy: [{ customerId: "asc" }, { version: "desc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">报价模块</h1>

      <form action={createQuoteAction} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5">
        <select name="customerId" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required>
          <option value="">选择客户</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
        <input name="operationFee" type="number" step="0.01" placeholder="操作费" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        <input name="shippingFee" type="number" step="0.01" placeholder="尾程邮费" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        <input name="notes" placeholder="备注" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <SubmitButton pendingText="生成中..." className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
          生成新版本
        </SubmitButton>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">客户</th>
              <th className="px-4 py-3 text-left">版本</th>
              <th className="px-4 py-3 text-left">操作费</th>
              <th className="px-4 py-3 text-left">尾程邮费</th>
              <th className="px-4 py-3 text-left">总额</th>
              <th className="px-4 py-3 text-left">类型</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quotes.map((quote) => (
              <tr key={quote.id}>
                <td className="px-4 py-3">{quote.customer.name}</td>
                <td className="px-4 py-3">V{quote.version}</td>
                <td className="px-4 py-3">¥{Number(quote.operationFee).toFixed(2)}</td>
                <td className="px-4 py-3">¥{Number(quote.shippingFee).toFixed(2)}</td>
                <td className="px-4 py-3">¥{Number(quote.totalAmount).toFixed(2)}</td>
                <td className="px-4 py-3">{quote.isLatest ? "最新报价" : "历史报价"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
