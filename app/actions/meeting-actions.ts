"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MeetingSourceType } from "@prisma/client";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds } from "@/lib/data-scope";
import {
  buildMeetingSummaryTemplate,
  stringifyMeetingSummary,
} from "@/lib/meeting-summary";
import { prisma } from "@/lib/prisma";

const audioExts = new Set([".mp3", ".wav", ".m4a", ".aac"]);
const videoExts = new Set([".mp4", ".mov"]);

async function ensureCustomerAccessible(customerId: string, ownerIds: string[] | undefined) {
  if (!customerId) return null;
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      ...(ownerIds ? { ownerId: { in: ownerIds } } : {}),
    },
    select: { id: true },
  });
  if (!customer) {
    throw new Error("关联客户不存在或无权限");
  }
  return customer;
}

function detectSourceType(fileName: string): MeetingSourceType {
  const ext = path.extname(fileName).toLowerCase();
  if (audioExts.has(ext)) return "AUDIO_UPLOAD";
  if (videoExts.has(ext)) return "VIDEO_UPLOAD";
  throw new Error("仅支持 mp3/wav/m4a/aac/mp4/mov 格式");
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function saveMeetingFile(file: File) {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "meetings");
  await mkdir(uploadDir, { recursive: true });
  const ext = path.extname(file.name).toLowerCase();
  const savedFileName = `${Date.now()}-${randomUUID()}${ext}`;
  const filePath = path.join(uploadDir, savedFileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);
  return {
    fileUrl: `/uploads/meetings/${savedFileName}`,
    fileName: file.name,
  };
}

const createMeetingSchema = z.object({
  title: z.string().trim().min(1, "会议标题必填"),
  customerId: z.string().optional(),
  notes: z.string().optional(),
});

export async function createMeetingUploadAction(formData: FormData) {
  const user = await requireCurrentUser();
  const ownerIds = await getAccessibleOwnerIds(user);
  const parsed = createMeetingSchema.safeParse({
    title: String(formData.get("title") || ""),
    customerId: String(formData.get("customerId") || "") || undefined,
    notes: String(formData.get("notes") || "") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "参数校验失败");
  }

  const uploadFile = formData.get("uploadFile");
  if (!(uploadFile instanceof File) || uploadFile.size <= 0) {
    throw new Error("请上传会议音频或视频文件");
  }

  if (uploadFile.size > 300 * 1024 * 1024) {
    throw new Error("文件大小不能超过 300MB");
  }

  const sourceType = detectSourceType(uploadFile.name);
  await ensureCustomerAccessible(parsed.data.customerId ?? "", ownerIds);
  const saved = await saveMeetingFile(uploadFile);
  const summaryTemplate = stringifyMeetingSummary(buildMeetingSummaryTemplate());

  const meeting = await prisma.meetingRecord.create({
    data: {
      title: parsed.data.title,
      customerId: parsed.data.customerId || null,
      userId: user.id,
      sourceType,
      status: "PENDING",
      sourceUrl: saved.fileUrl,
      originalFileUrl: saved.fileUrl,
      originalFileName: saved.fileName,
      extractedAudioUrl: sourceType === "VIDEO_UPLOAD" ? "" : saved.fileUrl,
      transcript: "",
      aiSummary: summaryTemplate,
      notes: parsed.data.notes ?? "",
    },
    select: { id: true, customerId: true },
  });

  revalidatePath("/dashboard/meetings");
  if (meeting.customerId) {
    revalidatePath(`/dashboard/customers/${meeting.customerId}`);
  }

  redirect(`/dashboard/meetings/${meeting.id}/status`);
}

export async function processMeetingAction(formData: FormData) {
  const user = await requireCurrentUser();
  const meetingId = String(formData.get("meetingId") || "");
  if (!meetingId) {
    throw new Error("缺少会议ID");
  }

  const ownerIds = await getAccessibleOwnerIds(user);
  const meeting = await prisma.meetingRecord.findFirst({
    where: {
      id: meetingId,
      ...(ownerIds ? { userId: { in: ownerIds } } : {}),
    },
    select: { id: true, sourceType: true, title: true, customerId: true, notes: true, originalFileUrl: true },
  });

  if (!meeting) {
    throw new Error("会议记录不存在或无权限");
  }

  await prisma.meetingRecord.update({
    where: { id: meeting.id },
    data: { status: "PROCESSING" },
  });

  const simulatedTranscript = [
    `【系统占位转写】会议：${meeting.title}`,
    "本次会议逐字稿暂未接入真实 ASR 服务。",
    "你可以在详情页手动编辑逐字稿，后续可无缝接入真实转写流水线。",
  ].join("\n");

  const simulatedSummary = stringifyMeetingSummary({
    summary: "系统占位纪要：当前为上传版流程，可手动编辑并用于后续跟进。",
    keyPoints: ["已上传会议文件", meeting.sourceType === "VIDEO_UPLOAD" ? "视频已进入音频提取环节（占位）" : "音频转写流程（占位）"],
    decisions: ["后续可接入真实 ASR/LLM"],
    actionItems: ["补充逐字稿", "完善会议纪要并关联客户动作"],
  });

  await prisma.meetingRecord.update({
    where: { id: meeting.id },
    data: {
      status: "COMPLETED",
      extractedAudioUrl: meeting.sourceType === "VIDEO_UPLOAD" ? meeting.originalFileUrl || "" : meeting.originalFileUrl || "",
      transcript: simulatedTranscript,
      aiSummary: simulatedSummary,
    },
  });

  revalidatePath("/dashboard/meetings");
  revalidatePath(`/dashboard/meetings/${meeting.id}`);
  revalidatePath(`/dashboard/meetings/${meeting.id}/status`);
  if (meeting.customerId) {
    revalidatePath(`/dashboard/customers/${meeting.customerId}`);
  }
}

const meetingMetaSchema = z.object({
  meetingId: z.string().min(1),
  title: z.string().trim().min(1, "会议标题必填"),
  customerId: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]),
});

export async function updateMeetingMetaAction(formData: FormData) {
  const user = await requireCurrentUser();
  const ownerIds = await getAccessibleOwnerIds(user);
  const parsed = meetingMetaSchema.safeParse({
    meetingId: String(formData.get("meetingId") || ""),
    title: String(formData.get("title") || ""),
    customerId: String(formData.get("customerId") || "") || undefined,
    notes: String(formData.get("notes") || "") || undefined,
    status: String(formData.get("status") || "PENDING"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "参数错误");
  }

  const meeting = await prisma.meetingRecord.findFirst({
    where: {
      id: parsed.data.meetingId,
      ...(ownerIds ? { userId: { in: ownerIds } } : {}),
    },
    select: { id: true, customerId: true },
  });

  if (!meeting) {
    throw new Error("会议记录不存在或无权限");
  }

  await ensureCustomerAccessible(parsed.data.customerId ?? "", ownerIds);

  await prisma.meetingRecord.update({
    where: { id: meeting.id },
    data: {
      title: parsed.data.title,
      customerId: parsed.data.customerId || null,
      notes: parsed.data.notes ?? "",
      status: parsed.data.status,
    },
  });

  revalidatePath("/dashboard/meetings");
  revalidatePath(`/dashboard/meetings/${meeting.id}`);
  if (meeting.customerId) revalidatePath(`/dashboard/customers/${meeting.customerId}`);
  if (parsed.data.customerId) revalidatePath(`/dashboard/customers/${parsed.data.customerId}`);
}

export async function updateMeetingTranscriptAction(formData: FormData) {
  const user = await requireCurrentUser();
  const ownerIds = await getAccessibleOwnerIds(user);
  const meetingId = String(formData.get("meetingId") || "");
  const transcript = String(formData.get("transcript") || "");

  if (!meetingId) {
    throw new Error("缺少会议ID");
  }

  const meeting = await prisma.meetingRecord.findFirst({
    where: {
      id: meetingId,
      ...(ownerIds ? { userId: { in: ownerIds } } : {}),
    },
    select: { id: true, customerId: true },
  });

  if (!meeting) {
    throw new Error("会议记录不存在或无权限");
  }

  await prisma.meetingRecord.update({
    where: { id: meeting.id },
    data: { transcript, status: "COMPLETED" },
  });

  revalidatePath(`/dashboard/meetings/${meeting.id}`);
  revalidatePath("/dashboard/meetings");
}

export async function updateMeetingSummaryAction(formData: FormData) {
  const user = await requireCurrentUser();
  const ownerIds = await getAccessibleOwnerIds(user);
  const meetingId = String(formData.get("meetingId") || "");
  if (!meetingId) {
    throw new Error("缺少会议ID");
  }

  const meeting = await prisma.meetingRecord.findFirst({
    where: {
      id: meetingId,
      ...(ownerIds ? { userId: { in: ownerIds } } : {}),
    },
    select: { id: true },
  });

  if (!meeting) {
    throw new Error("会议记录不存在或无权限");
  }

  const payload = stringifyMeetingSummary({
    summary: String(formData.get("summary") || "").trim(),
    keyPoints: splitLines(String(formData.get("keyPoints") || "")),
    decisions: splitLines(String(formData.get("decisions") || "")),
    actionItems: splitLines(String(formData.get("actionItems") || "")),
  });

  await prisma.meetingRecord.update({
    where: { id: meeting.id },
    data: { aiSummary: payload, status: "COMPLETED" },
  });

  revalidatePath(`/dashboard/meetings/${meeting.id}`);
  revalidatePath("/dashboard/meetings");
}
