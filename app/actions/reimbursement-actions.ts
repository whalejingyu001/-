"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import {
  encodeReasonWithAttachmentMeta,
  isMissingAttachmentColumnsError,
} from "@/lib/reimbursement-attachment";

const createSchema = z.object({
  amount: z.coerce.number().positive("报销金额必须大于 0"),
  reason: z.string().trim().min(5, "详细用途至少 5 个字"),
});

export async function createReimbursementAction(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = createSchema.safeParse({
    amount: formData.get("amount"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "报销参数不合法");
  }

  const attachment = formData.get("attachment");
  if (!(attachment instanceof File) || attachment.size <= 0) {
    throw new Error("请上传交易记录附件");
  }
  if (attachment.size > 20 * 1024 * 1024) {
    throw new Error("附件大小不能超过 20MB");
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "reimbursements");
  await mkdir(uploadDir, { recursive: true });
  const ext = path.extname(attachment.name);
  const savedFileName = `${Date.now()}-${randomUUID()}${ext}`;
  const filePath = path.join(uploadDir, savedFileName);
  const buffer = Buffer.from(await attachment.arrayBuffer());
  await writeFile(filePath, buffer);

  const attachmentUrl = `/uploads/reimbursements/${savedFileName}`;
  try {
    await prisma.reimbursement.create({
      data: {
        applicantId: user.id,
        amount: parsed.data.amount,
        reason: parsed.data.reason,
        attachmentName: attachment.name,
        attachmentUrl,
        status: "PENDING",
      },
    });
  } catch (error) {
    if (!isMissingAttachmentColumnsError(error)) {
      throw error;
    }

    // 兼容线上尚未执行 db push 的场景：先把附件元数据写入 reason，避免功能阻塞
    await prisma.reimbursement.create({
      data: {
        applicantId: user.id,
        amount: parsed.data.amount,
        reason: encodeReasonWithAttachmentMeta(parsed.data.reason, attachment.name, attachmentUrl),
        status: "PENDING",
      },
    });
  }

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
}

export async function reviewReimbursementAction(formData: FormData) {
  const user = await requireCurrentUser();
  if (user.role !== "FINANCE" && user.role !== "ADMIN") {
    throw new Error("无审核权限");
  }

  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "PENDING");
  const reviewNote = String(formData.get("reviewNote") || "").trim();
  if (!id) {
    throw new Error("缺少报销单 ID");
  }

  if (status !== "APPROVED" && status !== "REJECTED") {
    throw new Error("审核状态不合法");
  }

  if (status === "REJECTED" && !reviewNote) {
    throw new Error("驳回时请填写审核备注");
  }

  await prisma.reimbursement.update({
    where: { id },
    data: {
      status,
      reviewerId: user.id,
      reviewNote,
    },
  });

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
}
