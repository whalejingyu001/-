import { startOfMonth, startOfWeek } from "date-fns";
import { createReimbursementAction, reviewReimbursementAction } from "@/app/actions/reimbursement-actions";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { assertModuleAccess } from "@/lib/rbac";
import { REIMBURSEMENT_STATUS_LABELS } from "@/lib/enum-labels";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";
import {
  extractReasonAndAttachment,
  isMissingAttachmentColumnsError,
} from "@/lib/reimbursement-attachment";

type FinanceSearchParams = {
  status?: "PENDING" | "APPROVED" | "REJECTED" | "";
  applicantId?: string;
  dateFrom?: string;
  dateTo?: string;
  quoteKeyword?: string;
};

function toDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function statusVariant(status: "PENDING" | "APPROVED" | "REJECTED") {
  if (status === "APPROVED") return "success" as const;
  if (status === "REJECTED") return "danger" as const;
  return "warning" as const;
}

async function getReimbursementsWithFallback(where: Record<string, unknown>) {
  try {
    const rows = await prisma.reimbursement.findMany({
      where,
      include: { applicant: { select: { id: true, name: true } }, reviewer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((row) => {
      const parsed = extractReasonAndAttachment(row.reason, row.attachmentName, row.attachmentUrl);
      return {
        ...row,
        reasonText: parsed.reasonText,
        fileName: parsed.attachmentName,
        fileUrl: parsed.attachmentUrl,
      };
    });
  } catch (error) {
    if (!isMissingAttachmentColumnsError(error)) {
      throw error;
    }
    const rows = await prisma.reimbursement.findMany({
      where,
      include: { applicant: { select: { id: true, name: true } }, reviewer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((row) => {
      const parsed = extractReasonAndAttachment(row.reason);
      return {
        ...row,
        reasonText: parsed.reasonText,
        fileName: parsed.attachmentName,
        fileUrl: parsed.attachmentUrl,
      };
    });
  }
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<FinanceSearchParams>;
}) {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "finance");
  const params = await searchParams;
  const ownerIds = await getAccessibleOwnerIds(user);
  const quoteKeyword = (params.quoteKeyword ?? "").trim();

  const reimbursementScope =
    user.role === "FINANCE" || user.role === "ADMIN"
      ? {}
      : { applicantId: { in: ownerIds ?? [user.id] } };

  const dateFrom = toDate(params.dateFrom);
  const dateTo = toDate(params.dateTo);
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const reimbursementWhere = {
    ...reimbursementScope,
    ...(params.status ? { status: params.status } : {}),
    ...(params.applicantId ? { applicantId: params.applicantId } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: new Date(`${params.dateTo}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };

  const [quotes, reimbursements, applicants, pendingCount, weekAmount, monthAmount, approvedAmount] = await Promise.all([
    prisma.quote.findMany({
      where: {
        customer: ownerIds ? { ownerId: { in: ownerIds } } : {},
        ...(quoteKeyword
          ? {
              customer: {
                ...(ownerIds ? { ownerId: { in: ownerIds } } : {}),
                name: { contains: quoteKeyword, mode: "insensitive" },
              },
            }
          : {}),
      },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    getReimbursementsWithFallback(reimbursementWhere),
    prisma.user.findMany({
      where:
        user.role === "FINANCE" || user.role === "ADMIN"
          ? { status: "ACTIVE" }
          : { id: { in: ownerIds ?? [user.id] } },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.reimbursement.count({
      where: { ...reimbursementScope, status: "PENDING" },
    }),
    prisma.reimbursement.aggregate({
      _sum: { amount: true },
      where: { ...reimbursementScope, createdAt: { gte: weekStart, lte: now } },
    }),
    prisma.reimbursement.aggregate({
      _sum: { amount: true },
      where: { ...reimbursementScope, createdAt: { gte: monthStart, lte: now } },
    }),
    prisma.reimbursement.aggregate({
      _sum: { amount: true },
      where: { ...reimbursementScope, status: "APPROVED" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">财务中心</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="待审核报销数" value={pendingCount} />
        <StatCard title="本周报销金额" value={`¥${Number(weekAmount._sum.amount ?? 0).toFixed(2)}`} />
        <StatCard title="本月报销金额" value={`¥${Number(monthAmount._sum.amount ?? 0).toFixed(2)}`} />
        <StatCard title="已通过报销总额" value={`¥${Number(approvedAmount._sum.amount ?? 0).toFixed(2)}`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <form action={createReimbursementAction} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">报销申请</h2>
          <input name="amount" type="number" step="0.01" placeholder="金额（必填）" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
          <textarea
            name="reason"
            placeholder="详细用途（必填，例如：4月客户拜访交通与餐饮费用）"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <input
            name="attachment"
            type="file"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <p className="text-xs text-slate-500">交易记录附件（必填），建议上传发票/付款凭证，单文件不超过 20MB</p>
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">提交申请</button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">客户最新报价</h2>
          <form className="mb-3 flex gap-2">
            <input
              name="quoteKeyword"
              defaultValue={params.quoteKeyword ?? ""}
              placeholder="按客户名筛选报价"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">筛选</button>
          </form>
          <div className="space-y-2 text-sm">
            {quotes.map((quote) => (
              <div key={quote.id} className="flex justify-between rounded bg-slate-50 px-3 py-2">
                <span>
                  {quote.customer.name} V{quote.version}
                </span>
                <span>¥{Number(quote.totalAmount).toFixed(2)}</span>
              </div>
            ))}
            {quotes.length === 0 ? <p className="text-slate-500">暂无报价记录</p> : null}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <form className="grid grid-cols-1 gap-3 border-b border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
          <select name="status" defaultValue={params.status ?? ""} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">全部状态</option>
            <option value="PENDING">待审核</option>
            <option value="APPROVED">已通过</option>
            <option value="REJECTED">已驳回</option>
          </select>
          <select name="applicantId" defaultValue={params.applicantId ?? ""} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">全部申请人</option>
            {applicants.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input name="dateFrom" type="date" defaultValue={params.dateFrom ?? ""} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
          <input name="dateTo" type="date" defaultValue={params.dateTo ?? ""} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">筛选</button>
            <a href="/dashboard/finance" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-center text-sm text-slate-700">
              重置
            </a>
          </div>
        </form>

        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">申请人</th>
              <th className="px-4 py-3 text-left">申请时间</th>
              <th className="px-4 py-3 text-left">金额</th>
              <th className="px-4 py-3 text-left">原因</th>
              <th className="px-4 py-3 text-left">附件</th>
              <th className="px-4 py-3 text-left">状态</th>
              <th className="px-4 py-3 text-left">审核备注</th>
              <th className="px-4 py-3 text-left">审核</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reimbursements.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">{row.applicant.name}</td>
                <td className="px-4 py-3">{row.createdAt.toLocaleString("zh-CN")}</td>
                <td className="px-4 py-3">¥{Number(row.amount).toFixed(2)}</td>
                <td className="px-4 py-3">{row.reasonText}</td>
                <td className="px-4 py-3">
                  {row.fileUrl ? (
                    <a href={row.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                      {row.fileName || "查看附件"}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge text={REIMBURSEMENT_STATUS_LABELS[row.status]} variant={statusVariant(row.status)} />
                </td>
                <td className="px-4 py-3">{row.reviewNote || "-"}</td>
                <td className="px-4 py-3">
                  {(user.role === "FINANCE" || user.role === "ADMIN") && row.status === "PENDING" ? (
                    <form action={reviewReimbursementAction} className="space-y-2">
                      <input type="hidden" name="id" value={row.id} />
                      <input
                        name="reviewNote"
                        placeholder="审核备注（驳回必填）"
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                      <div className="flex gap-2">
                        <button name="status" value="APPROVED" className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700">
                          通过
                        </button>
                        <button name="status" value="REJECTED" className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700">
                          驳回
                        </button>
                      </div>
                    </form>
                  ) : (
                    row.reviewer?.name ?? "-"
                  )}
                </td>
              </tr>
            ))}
            {reimbursements.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  暂无报销记录
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
