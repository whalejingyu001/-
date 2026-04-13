"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

export async function createMeetingRecordAction(formData: FormData) {
  const user = await requireCurrentUser();
  const customerId = String(formData.get("customerId") || "");
  const title = String(formData.get("title") || "会议记录");
  const transcript = String(formData.get("transcript") || "");

  const ownerIds = await getAccessibleOwnerIds(user);
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      ...(ownerIds ? { ownerId: { in: ownerIds } } : {}),
    },
  });

  if (!customer) {
    throw new Error("客户不存在或无权限");
  }

  await prisma.meetingRecord.create({
    data: {
      customerId,
      userId: user.id,
      title,
      sourceType: "AUDIO_UPLOAD",
      transcript,
      aiSummary: JSON.stringify({
        summary: "系统示例总结：请接入你们的 ASR 与大模型服务进行自动化会议纪要。",
        keyPoints: ["会议内容已录入"],
        decisions: ["待确认"],
        actionItems: ["销售跟进下一步计划"],
      }),
    },
  });

  revalidatePath("/dashboard/meetings");
}
