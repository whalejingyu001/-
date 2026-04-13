import { createMeetingRecordAction } from "@/app/actions/meeting-actions";
import { MEETING_SOURCE_LABELS } from "@/lib/enum-labels";
import { assertModuleAccess } from "@/lib/rbac";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds, ownerScope } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

export default async function MeetingsPage() {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "meetings");

  const ownerIds = await getAccessibleOwnerIds(user);
  const [customers, meetings] = await Promise.all([
    prisma.customer.findMany({ where: ownerScope(ownerIds), orderBy: { name: "asc" } }),
    prisma.meetingRecord.findMany({
      where: { customer: ownerScope(ownerIds) },
      include: { customer: { select: { name: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">智能会议记录</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm text-slate-500">支持：实时录音 / 上传音频 / 上传视频（当前为轻量版演示，默认按上传音频处理）</p>
        <form action={createMeetingRecordAction} className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select name="customerId" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required>
            <option value="">关联客户</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <input name="title" placeholder="会议标题" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">生成逐字稿与纪要</button>
          <textarea
            name="transcript"
            placeholder="录音转写文本（演示可手工粘贴）"
            className="md:col-span-3 min-h-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          />
        </form>
      </div>

      <div className="space-y-3">
        {meetings.map((meeting) => (
          <div key={meeting.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{meeting.title}</h2>
              <span className="text-xs text-slate-500">{MEETING_SOURCE_LABELS[meeting.sourceType]}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">客户：{meeting.customer?.name ?? "未关联"} | 记录人：{meeting.user.name}</p>
            <p className="mt-3 text-sm text-slate-700">逐字稿：{meeting.transcript}</p>
            <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-700">
              {JSON.stringify(JSON.parse(meeting.aiSummary), null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
