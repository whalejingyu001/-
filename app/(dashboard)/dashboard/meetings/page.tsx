import Link from "next/link";
import { createMeetingUploadAction } from "@/app/actions/meeting-actions";
import { Badge } from "@/components/ui/badge";
import { MEETING_SOURCE_LABELS, MEETING_STATUS_LABELS } from "@/lib/enum-labels";
import { assertModuleAccess } from "@/lib/rbac";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds, ownerScope } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  q?: string;
  customerId?: string;
};

function statusVariant(status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED") {
  if (status === "COMPLETED") return "success" as const;
  if (status === "FAILED") return "danger" as const;
  if (status === "PROCESSING") return "info" as const;
  return "warning" as const;
}

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "meetings");
  const params = await searchParams;
  const keyword = (params.q ?? "").trim();

  const ownerIds = await getAccessibleOwnerIds(user);
  const [customers, meetings] = await Promise.all([
    prisma.customer.findMany({
      where: ownerScope(ownerIds),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.meetingRecord.findMany({
      where: {
        ...(ownerIds ? { userId: { in: ownerIds } } : {}),
        ...(keyword ? { title: { contains: keyword, mode: "insensitive" } } : {}),
        ...(params.customerId ? { customerId: params.customerId } : {}),
      },
      include: {
        customer: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">智能会议记录中心</h1>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">新建会议记录（上传版）</h2>
        <form action={createMeetingUploadAction} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input name="title" placeholder="会议标题" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
          <select name="customerId" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">关联客户（可选）</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <textarea
            name="notes"
            placeholder="备注（可选）"
            className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">上传音频/视频文件</label>
            <input
              name="uploadFile"
              type="file"
              accept=".mp3,.wav,.m4a,.aac,.mp4,.mov,audio/*,video/*"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <p className="mt-1 text-xs text-slate-500">支持 mp3 / wav / m4a / aac / mp4 / mov，最大 300MB</p>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">上传并创建会议记录</button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">会议记录列表</h2>
        <form className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="按会议标题搜索"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <select name="customerId" defaultValue={params.customerId ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">全部客户</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">筛选</button>
        </form>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">会议标题</th>
                <th className="px-4 py-3 text-left">关联客户</th>
                <th className="px-4 py-3 text-left">来源类型</th>
                <th className="px-4 py-3 text-left">创建人</th>
                <th className="px-4 py-3 text-left">创建时间</th>
                <th className="px-4 py-3 text-left">处理状态</th>
                <th className="px-4 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {meetings.map((meeting) => (
                <tr key={meeting.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{meeting.title}</td>
                  <td className="px-4 py-3">{meeting.customer?.name ?? "-"}</td>
                  <td className="px-4 py-3">{MEETING_SOURCE_LABELS[meeting.sourceType]}</td>
                  <td className="px-4 py-3">{meeting.user.name}</td>
                  <td className="px-4 py-3">{meeting.createdAt.toLocaleString("zh-CN")}</td>
                  <td className="px-4 py-3">
                    <Badge text={MEETING_STATUS_LABELS[meeting.status]} variant={statusVariant(meeting.status)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={`/dashboard/meetings/${meeting.id}/status`} className="text-blue-600 underline">
                        状态
                      </Link>
                      <Link href={`/dashboard/meetings/${meeting.id}`} className="text-blue-600 underline">
                        详情
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {meetings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    暂无会议记录
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

