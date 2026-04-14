import Link from "next/link";
import { notFound } from "next/navigation";
import { processMeetingAction } from "@/app/actions/meeting-actions";
import { MEETING_SOURCE_LABELS, MEETING_STATUS_LABELS } from "@/lib/enum-labels";
import { assertModuleAccess } from "@/lib/rbac";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

function getSteps(sourceType: "AUDIO_UPLOAD" | "VIDEO_UPLOAD", status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED") {
  const video = sourceType === "VIDEO_UPLOAD";
  const completed = status === "COMPLETED";
  const failed = status === "FAILED";

  return [
    { label: "文件上传中", done: true, current: false, failed: false },
    { label: "音频提取中", done: video ? completed : true, current: video && status === "PROCESSING", failed },
    { label: "转写中", done: completed, current: status === "PROCESSING", failed },
    { label: "AI总结中", done: completed, current: status === "PROCESSING", failed },
    {
      label: completed ? "已完成" : failed ? "失败" : status === "PENDING" ? "待处理" : "处理中",
      done: completed,
      current: !completed && !failed,
      failed,
    },
  ];
}

export default async function MeetingStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "meetings");
  const { id } = await params;
  const ownerIds = await getAccessibleOwnerIds(user);

  const meeting = await prisma.meetingRecord.findFirst({
    where: {
      id,
      ...(ownerIds ? { userId: { in: ownerIds } } : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      user: { select: { name: true } },
    },
  });

  if (!meeting) {
    notFound();
  }

  const steps = getSteps(meeting.sourceType, meeting.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">会议处理状态</h1>
          <p className="mt-1 text-sm text-slate-500">{meeting.title}</p>
        </div>
        <Link href={`/dashboard/meetings/${meeting.id}`} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
          查看详情
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-3">
          <p>来源类型：{MEETING_SOURCE_LABELS[meeting.sourceType]}</p>
          <p>关联客户：{meeting.customer?.name ?? "-"}</p>
          <p>当前状态：{MEETING_STATUS_LABELS[meeting.status]}</p>
          <p>创建人：{meeting.user.name}</p>
          <p>创建时间：{meeting.createdAt.toLocaleString("zh-CN")}</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">处理流程</h2>
        <ol className="space-y-2">
          {steps.map((step, index) => (
            <li
              key={`${step.label}-${index}`}
              className={`rounded-md border px-3 py-2 text-sm ${
                step.failed
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : step.done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : step.current
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {index + 1}. {step.label}
            </li>
          ))}
        </ol>

        {meeting.status !== "COMPLETED" ? (
          <form action={processMeetingAction} className="mt-4">
            <input type="hidden" name="meetingId" value={meeting.id} />
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
              开始处理（占位流程）
            </button>
            <p className="mt-2 text-xs text-slate-500">
              第一版未接入真实 ASR/LLM，点击后会生成占位逐字稿与纪要，你可在详情页继续编辑。
            </p>
          </form>
        ) : null}
      </section>
    </div>
  );
}
