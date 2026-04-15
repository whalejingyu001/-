import { notFound } from "next/navigation";
import {
  completeFollowUpAction,
  createFollowUpAction,
  updateCustomerStageAction,
  updateCustomerTagsAction,
} from "@/app/actions/customer-actions";
import { createQuoteAction } from "@/app/actions/quote-actions";
import { Badge } from "@/components/ui/badge";
import {
  CUSTOMER_PRIORITY_LABELS,
  CUSTOMER_STAGE_LABELS,
  FOLLOW_UP_STATUS_LABELS,
  MEETING_SOURCE_LABELS,
  MEETING_STATUS_LABELS,
} from "@/lib/enum-labels";
import { assertModuleAccess } from "@/lib/rbac";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

function splitComma(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseFollowUpContent(content: string) {
  try {
    const parsed = JSON.parse(content) as { todo?: string; result?: string; nextAction?: string };
    return {
      todo: parsed.todo ?? "",
      result: parsed.result ?? "",
      nextAction: parsed.nextAction ?? "",
    };
  } catch {
    return { todo: "", result: content, nextAction: "" };
  }
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stageUpdated?: string }>;
}) {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "customers");
  const { id } = await params;
  const query = await searchParams;

  const ownerIds = await getAccessibleOwnerIds(user);
  const customer = await prisma.customer.findFirst({
    where: {
      id,
      ...(ownerIds ? { ownerId: { in: ownerIds } } : {}),
    },
    include: {
      followUps: { orderBy: { createdAt: "desc" }, take: 20 },
      meetings: { orderBy: { createdAt: "desc" }, take: 10 },
      quotes: { orderBy: { version: "desc" }, include: { attachments: true } },
      owner: { select: { name: true } },
    },
  });

  if (!customer) {
    notFound();
  }

  const tags = splitComma(customer.tags);
  const businessNeeds = splitComma(customer.businessNeeds);
  const latestQuote = customer.quotes.find((quote) => quote.isLatest) ?? null;
  const historyQuotes = customer.quotes.filter((quote) => !quote.isLatest);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">客户详情</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">基本信息</h2>
        <div className="grid grid-cols-1 gap-3 text-sm text-slate-700 md:grid-cols-3">
          <div><span className="text-slate-500">姓名：</span>{customer.name}</div>
          <div><span className="text-slate-500">公司名：</span>{customer.companyName ?? "-"}</div>
          <div><span className="text-slate-500">联系人职位：</span>{customer.title ?? "-"}</div>
          <div><span className="text-slate-500">电话：</span>{customer.phone ?? "-"}</div>
          <div><span className="text-slate-500">微信：</span>{customer.wechat ?? "-"}</div>
          <div><span className="text-slate-500">开户人：</span>{customer.owner.name}</div>
          <div><span className="text-slate-500">客户优先级：</span><Badge text={CUSTOMER_PRIORITY_LABELS[customer.priority]} variant={customer.priority === "CRITICAL" ? "danger" : "info"} /></div>
          <div><span className="text-slate-500">销售阶段：</span>{CUSTOMER_STAGE_LABELS[customer.stage]}</div>
          <div className="md:col-span-2"><span className="text-slate-500">业务需求：</span>{businessNeeds.length ? businessNeeds.join("、") : "-"}</div>
          <div className="md:col-span-3"><span className="text-slate-500">备注：</span>{customer.notes ?? "-"}</div>
        </div>
        <form action={updateCustomerStageAction} className="mt-4 flex items-center gap-3">
          <input type="hidden" name="customerId" value={customer.id} />
          <select name="stage" defaultValue={customer.stage} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="NEW">新客户</option>
            <option value="CONTACTED">已联系</option>
            <option value="FOLLOWING">跟进中</option>
            <option value="WON">已成交</option>
          </select>
          <button type="submit" className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">修改阶段</button>
        </form>
        {query.stageUpdated === "1" ? <p className="mt-2 text-xs text-emerald-600">销售阶段已保存</p> : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">客户标签</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {tags.length ? tags.map((tag) => <Badge key={tag} text={tag} />) : <span className="text-sm text-slate-500">暂无标签</span>}
        </div>
        <form action={updateCustomerTagsAction} className="flex gap-3">
          <input type="hidden" name="customerId" value={customer.id} />
          <input name="tags" defaultValue={customer.tags} placeholder="使用逗号分隔标签，如：重点客户,跨境" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">保存标签</button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">跟进记录</h2>
          <a href="#followup-create" className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white">
            新增跟进
          </a>
        </div>
        <form id="followup-create" action={createFollowUpAction} className="mb-4 grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
          <input type="hidden" name="customerId" value={customer.id} />
          <input name="todo" placeholder="跟进事项（必填）" className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" required />
          <input
            name="nextFollowAt"
            type="datetime-local"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <div className="md:col-span-3 flex justify-end">
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">新增跟进</button>
          </div>
        </form>
        <div className="space-y-2 text-sm">
          {customer.followUps.map((item) => (
            <div key={item.id} className="rounded bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">{parseFollowUpContent(item.content).todo || "跟进记录"}</span>
                <Badge text={FOLLOW_UP_STATUS_LABELS[item.status]} variant={item.status === "DONE" ? "success" : "warning"} />
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-slate-600 md:grid-cols-3">
                <p>跟进时间：{item.dueAt?.toLocaleString("zh-CN") ?? "-"}</p>
                <p>跟进结果：{parseFollowUpContent(item.content).result || (item.status === "PENDING" ? "待填写" : "-")}</p>
                <p>下一步动作：{parseFollowUpContent(item.content).nextAction || "-"}</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">创建时间：{item.createdAt.toLocaleString("zh-CN")}</p>
              {item.status === "PENDING" ? (
                <form action={completeFollowUpAction} className="mt-3 grid grid-cols-1 gap-2 rounded border border-amber-200 bg-amber-50 p-3 md:grid-cols-3">
                  <input type="hidden" name="customerId" value={customer.id} />
                  <input type="hidden" name="followUpId" value={item.id} />
                  <input
                    name="result"
                    placeholder="跟进结果（必填）"
                    className="rounded-md border border-amber-300 px-3 py-2 text-sm md:col-span-3"
                    required
                  />
                  <input name="nextAction" placeholder="下一步动作（可选）" className="rounded-md border border-amber-300 px-3 py-2 text-sm md:col-span-2" />
                  <input
                    name="nextFollowAt"
                    type="datetime-local"
                    className="rounded-md border border-amber-300 px-3 py-2 text-sm"
                    required
                  />
                  <div className="md:col-span-3 flex justify-end">
                    <button className="rounded-md bg-amber-600 px-4 py-2 text-sm text-white">提交结果并完成</button>
                  </div>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">会议记录</h2>
          <div className="space-y-2 text-sm">
            {customer.meetings.length === 0 ? <p className="text-slate-500">暂无会议记录</p> : null}
            {customer.meetings.map((meeting) => (
              <div key={meeting.id} className="rounded bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-800">{meeting.title}</p>
                  <span className="text-xs text-slate-500">{MEETING_SOURCE_LABELS[meeting.sourceType]}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{meeting.createdAt.toLocaleString("zh-CN")}</p>
                <p className="mt-1 text-xs text-slate-500">状态：{MEETING_STATUS_LABELS[meeting.status]}</p>
                <a href={`/dashboard/meetings/${meeting.id}`} className="mt-2 inline-block text-xs text-blue-600 underline">
                  查看详情
                </a>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">报价记录</h2>
            <details className="group">
              <summary className="cursor-pointer rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white">
                新增报价记录
              </summary>
              <form action={createQuoteAction} className="mt-3 grid grid-cols-1 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                <input type="hidden" name="customerId" value={customer.id} />
                <input name="quoteDate" type="date" className="rounded-md border border-slate-300 px-3 py-2" required />
                <input name="operationFee" type="number" step="0.01" placeholder="操作费" className="rounded-md border border-slate-300 px-3 py-2" required />
                <input name="finalMileFee" type="number" step="0.01" placeholder="尾程运费" className="rounded-md border border-slate-300 px-3 py-2" required />
                <input name="notes" placeholder="备注" className="rounded-md border border-slate-300 px-3 py-2" />
                <input name="attachment" type="file" className="rounded-md border border-slate-300 px-3 py-2" />
                <button className="rounded-md bg-slate-900 px-3 py-2 text-white">保存报价</button>
              </form>
            </details>
          </div>
          <div className="space-y-3 text-sm">
            <div className="rounded bg-emerald-50 p-3">
              <p className="font-medium text-emerald-800">最新报价</p>
              {latestQuote ? (
                <div className="mt-1 space-y-1 text-emerald-700">
                  <p>版本号：V{latestQuote.version}</p>
                  <p>报价日期：{latestQuote.quoteDate.toLocaleDateString("zh-CN")}</p>
                  <p>操作费：¥{Number(latestQuote.operationFee).toFixed(2)}</p>
                  <p>尾程运费：¥{Number(latestQuote.finalMileFee).toFixed(2)}</p>
                  <p>
                    附件：
                    {latestQuote.attachments.length > 0 ? (
                      <a href={latestQuote.attachments[0].fileUrl} target="_blank" className="ml-1 underline">
                        {latestQuote.attachments[0].fileName}
                      </a>
                    ) : (
                      "无附件"
                    )}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-emerald-700">暂无</p>
              )}
            </div>
            <div>
              <p className="mb-2 font-medium text-slate-700">历史报价</p>
              {historyQuotes.length === 0 ? <p className="text-slate-500">暂无历史报价</p> : null}
              <div className="space-y-2">
                {historyQuotes.map((quote) => (
                  <div key={quote.id} className="rounded bg-slate-50 p-3">
                    <p>版本号：V{quote.version}</p>
                    <p>报价日期：{quote.quoteDate.toLocaleDateString("zh-CN")}</p>
                    <p>操作费：¥{Number(quote.operationFee).toFixed(2)}</p>
                    <p>尾程运费：¥{Number(quote.finalMileFee).toFixed(2)}</p>
                    <p>
                      附件状态：
                      {quote.attachments.length > 0 ? (
                        <a href={quote.attachments[0].fileUrl} target="_blank" className="ml-1 underline">
                          {quote.attachments[0].fileName}
                        </a>
                      ) : (
                        "无附件"
                      )}
                    </p>
                    <p className="text-xs text-slate-500">{quote.createdAt.toLocaleString("zh-CN")}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
