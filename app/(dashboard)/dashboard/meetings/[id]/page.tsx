import Link from "next/link";
import { notFound } from "next/navigation";
import {
  updateMeetingMetaAction,
  updateMeetingSummaryAction,
  updateMeetingTranscriptAction,
} from "@/app/actions/meeting-actions";
import { Badge } from "@/components/ui/badge";
import { MEETING_SOURCE_LABELS, MEETING_STATUS_LABELS } from "@/lib/enum-labels";
import { assertModuleAccess } from "@/lib/rbac";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds, ownerScope } from "@/lib/data-scope";
import { getMeetingSummaryFormValue } from "@/lib/meeting-summary";
import { prisma } from "@/lib/prisma";

function statusVariant(status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED") {
  if (status === "COMPLETED") return "success" as const;
  if (status === "FAILED") return "danger" as const;
  if (status === "PROCESSING") return "info" as const;
  return "warning" as const;
}

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "meetings");
  const { id } = await params;
  const ownerIds = await getAccessibleOwnerIds(user);

  const [meeting, customers] = await Promise.all([
    prisma.meetingRecord.findFirst({
      where: {
        id,
        ...(ownerIds ? { userId: { in: ownerIds } } : {}),
      },
      include: {
        customer: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.customer.findMany({
      where: ownerScope(ownerIds),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!meeting) {
    notFound();
  }

  const summary = getMeetingSummaryFormValue(meeting.aiSummary || "");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">会议详情</h1>
          <p className="mt-1 text-sm text-slate-500">{meeting.title}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/meetings/${meeting.id}/status`} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            处理状态
          </Link>
          <Link href="/dashboard/meetings" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            返回列表
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">基本信息</h2>
        <div className="mb-4 grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-3">
          <p>会议标题：{meeting.title}</p>
          <p>关联客户：{meeting.customer?.name ?? "未关联"}</p>
          <p>来源类型：{MEETING_SOURCE_LABELS[meeting.sourceType]}</p>
          <p>创建人：{meeting.user.name}</p>
          <p>创建时间：{meeting.createdAt.toLocaleString("zh-CN")}</p>
          <p>
            处理状态：
            <span className="ml-1 inline-block align-middle">
              <Badge text={MEETING_STATUS_LABELS[meeting.status]} variant={statusVariant(meeting.status)} />
            </span>
          </p>
        </div>

        <form action={updateMeetingMetaAction} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input type="hidden" name="meetingId" value={meeting.id} />
          <input name="title" defaultValue={meeting.title} className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
          <select name="customerId" defaultValue={meeting.customerId ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">不关联客户</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={meeting.status} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="PENDING">待处理</option>
            <option value="PROCESSING">处理中</option>
            <option value="COMPLETED">已完成</option>
            <option value="FAILED">失败</option>
          </select>
          <textarea name="notes" defaultValue={meeting.notes ?? ""} placeholder="备注" className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
          <div className="md:col-span-2 flex justify-end">
            <button className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">保存基本信息</button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">原始文件</h2>
        <div className="space-y-1 text-sm text-slate-700">
          <p>文件名：{meeting.originalFileName ?? "-"}</p>
          <p>文件类型：{MEETING_SOURCE_LABELS[meeting.sourceType]}</p>
          <p>
            文件链接：
            {meeting.originalFileUrl ? (
              <a href={meeting.originalFileUrl} target="_blank" className="ml-1 text-blue-600 underline" rel="noreferrer">
                下载/查看
              </a>
            ) : (
              "-"
            )}
          </p>
          {meeting.sourceType === "VIDEO_UPLOAD" ? (
            <p>
              提取音频：
              {meeting.extractedAudioUrl ? (
                <a href={meeting.extractedAudioUrl} target="_blank" className="ml-1 text-blue-600 underline" rel="noreferrer">
                  查看
                </a>
              ) : (
                "待处理"
              )}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">逐字稿</h2>
        <form action={updateMeetingTranscriptAction} className="space-y-3">
          <input type="hidden" name="meetingId" value={meeting.id} />
          <textarea
            name="transcript"
            defaultValue={meeting.transcript}
            className="min-h-56 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="转写内容"
          />
          <div className="flex justify-end">
            <button className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">保存逐字稿</button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">AI会议纪要</h2>
        <form action={updateMeetingSummaryAction} className="grid grid-cols-1 gap-3">
          <input type="hidden" name="meetingId" value={meeting.id} />
          <textarea
            name="summary"
            defaultValue={summary.summary}
            placeholder="会议摘要"
            className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            name="keyPoints"
            defaultValue={summary.keyPoints}
            placeholder="核心讨论点（每行一条）"
            className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            name="decisions"
            defaultValue={summary.decisions}
            placeholder="结论 / 决策（每行一条）"
            className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            name="actionItems"
            defaultValue={summary.actionItems}
            placeholder="待跟进事项（每行一条）"
            className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex justify-end">
            <button className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">保存会议纪要</button>
          </div>
        </form>
      </section>
    </div>
  );
}
