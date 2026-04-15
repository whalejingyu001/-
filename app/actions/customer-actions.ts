"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RoleName } from "@prisma/client";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

const customerSchema = z.object({
  name: z.string().min(2),
  companyName: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  wechat: z.string().optional(),
  ownerId: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  businessNeeds: z.array(z.enum(["海外仓", "机构"])).default([]),
  notes: z.string().optional(),
  unitProfit: z.coerce.number().min(0),
});

export async function createCustomerAction(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    companyName: formData.get("companyName") ?? undefined,
    title: formData.get("title") ?? undefined,
    phone: formData.get("phone") ?? undefined,
    wechat: formData.get("wechat") ?? undefined,
    ownerId: formData.get("ownerId"),
    priority: formData.get("priority"),
    businessNeeds: formData.getAll("businessNeeds"),
    notes: formData.get("notes") ?? undefined,
    unitProfit: formData.get("unitProfit"),
  });

  if (!parsed.success) {
    throw new Error("客户信息校验失败");
  }

  const owner = await prisma.user.findFirst({
    where: {
      id: parsed.data.ownerId,
      role: { name: { in: [RoleName.SALES, RoleName.SALES_MANAGER] } },
      status: "ACTIVE",
    },
  });

  if (!owner) {
    throw new Error("开户人必须是有效销售账号");
  }

  if (user.role === "SALES" && parsed.data.ownerId !== user.id) {
    throw new Error("销售只能将客户开在自己名下");
  }

  await prisma.customer.create({
    data: {
      name: parsed.data.name,
      companyName: parsed.data.companyName,
      title: parsed.data.title,
      phone: parsed.data.phone,
      wechat: parsed.data.wechat,
      ownerId: parsed.data.ownerId,
      priority: parsed.data.priority,
      businessNeeds: parsed.data.businessNeeds.join(","),
      notes: parsed.data.notes,
      unitProfit: parsed.data.unitProfit,
      createdById: user.id,
      tags: "新客户",
    },
  });

  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
}

export async function createFollowUpAction(formData: FormData) {
  const user = await requireCurrentUser();
  const customerId = String(formData.get("customerId") || "");
  const todo = String(formData.get("todo") || "");
  const nextFollowAtRaw = String(formData.get("nextFollowAt") || "");

  if (!customerId || !todo || !nextFollowAtRaw) {
    throw new Error("参数缺失");
  }

  const nextFollowAt = new Date(nextFollowAtRaw);
  if (Number.isNaN(nextFollowAt.getTime())) {
    throw new Error("下一次跟进时间不合法");
  }

  const ownerIds = await getAccessibleOwnerIds(user);
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      ...(ownerIds ? { ownerId: { in: ownerIds } } : {}),
    },
  });

  if (!customer) {
    throw new Error("无权限访问客户");
  }

  if (user.role === "SALES" && customer.ownerId !== user.id) {
    throw new Error("销售只能操作自己的客户跟进");
  }

  await prisma.$transaction(async (tx) => {
    await tx.followUp.create({
      data: {
        customerId,
        userId: user.id,
        content: JSON.stringify({
          todo: todo.trim(),
          result: "",
          nextAction: "",
        }),
        dueAt: nextFollowAt,
        status: "PENDING",
      },
    });

    await tx.customer.update({
      where: { id: customerId },
      data: { nextFollowUpAt: nextFollowAt },
    });
  });

  revalidatePath(`/dashboard/customers/${customerId}`);
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
}

const completeFollowUpSchema = z.object({
  customerId: z.string().min(1),
  followUpId: z.string().min(1),
  result: z.string().trim().min(1, "跟进结果必填"),
  nextAction: z.string().optional(),
  nextFollowAt: z.string().min(1, "下一次跟进时间必填"),
});

export async function completeFollowUpAction(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = completeFollowUpSchema.safeParse({
    customerId: String(formData.get("customerId") || ""),
    followUpId: String(formData.get("followUpId") || ""),
    result: String(formData.get("result") || ""),
    nextAction: String(formData.get("nextAction") || ""),
    nextFollowAt: String(formData.get("nextFollowAt") || ""),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "参数校验失败");
  }

  const ownerIds = await getAccessibleOwnerIds(user);
  const followUp = await prisma.followUp.findFirst({
    where: {
      id: parsed.data.followUpId,
      customerId: parsed.data.customerId,
      customer: ownerIds ? { ownerId: { in: ownerIds } } : undefined,
    },
    include: {
      customer: { select: { id: true, ownerId: true } },
    },
  });

  if (!followUp) {
    throw new Error("无权限访问跟进记录");
  }
  if (user.role === "SALES" && followUp.userId !== user.id) {
    throw new Error("销售只能处理自己创建的跟进");
  }

  const nextFollowAt = new Date(parsed.data.nextFollowAt);
  if (Number.isNaN(nextFollowAt.getTime())) {
    throw new Error("下一次跟进时间不合法");
  }

  let previousTodo = "";
  try {
    const content = JSON.parse(followUp.content) as { todo?: string };
    previousTodo = content.todo ?? "";
  } catch {
    previousTodo = followUp.content;
  }

  await prisma.$transaction(async (tx) => {
    await tx.followUp.update({
      where: { id: followUp.id },
      data: {
        status: "DONE",
        completedAt: new Date(),
        dueAt: nextFollowAt,
        content: JSON.stringify({
          todo: previousTodo,
          result: parsed.data.result.trim(),
          nextAction: parsed.data.nextAction?.trim() ?? "",
        }),
      },
    });

    await tx.customer.update({
      where: { id: followUp.customer.id },
      data: { nextFollowUpAt: nextFollowAt },
    });
  });

  revalidatePath(`/dashboard/customers/${followUp.customer.id}`);
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
}

export async function updateCustomerTagsAction(formData: FormData) {
  const user = await requireCurrentUser();
  const customerId = String(formData.get("customerId") || "");
  const tags = String(formData.get("tags") || "").trim();

  if (!customerId) {
    throw new Error("缺少客户ID");
  }

  const ownerIds = await getAccessibleOwnerIds(user);
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      ...(ownerIds ? { ownerId: { in: ownerIds } } : {}),
    },
    select: { id: true },
  });

  if (!customer) {
    throw new Error("无权限访问客户");
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: { tags },
  });

  revalidatePath(`/dashboard/customers/${customerId}`);
}

export async function updateCustomerStageAction(formData: FormData) {
  const user = await requireCurrentUser();
  const customerId = String(formData.get("customerId") || "");
  const stage = String(formData.get("stage") || "");

  if (!customerId) {
    throw new Error("缺少客户ID");
  }

  const stageParsed = z.enum(["NEW", "CONTACTED", "FOLLOWING", "WON"]).safeParse(stage);
  if (!stageParsed.success) {
    throw new Error("销售阶段不合法");
  }

  const ownerIds = await getAccessibleOwnerIds(user);
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      ...(ownerIds ? { ownerId: { in: ownerIds } } : {}),
    },
    select: { id: true },
  });

  if (!customer) {
    throw new Error("无权限访问客户");
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: { stage: stageParsed.data },
  });

  revalidatePath(`/dashboard/customers/${customerId}`);
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
  redirect(`/dashboard/customers/${customerId}?stageUpdated=1`);
}
