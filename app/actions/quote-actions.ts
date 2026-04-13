"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

export async function createQuoteAction(formData: FormData) {
  const user = await requireCurrentUser();
  const customerId = String(formData.get("customerId") || "");
  const operationFee = Number(formData.get("operationFee") || 0);
  const finalMileFee = Number(formData.get("finalMileFee") || formData.get("shippingFee") || 0);
  const quoteDateRaw = String(formData.get("quoteDate") || "");
  const quoteDate = quoteDateRaw ? new Date(quoteDateRaw) : new Date();
  const attachment = formData.get("attachment");

  if (Number.isNaN(quoteDate.getTime())) {
    throw new Error("报价日期格式不正确");
  }

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

  const latest = await prisma.quote.findFirst({
    where: { customerId },
    orderBy: { version: "desc" },
  });

  if (latest) {
    await prisma.quote.update({ where: { id: latest.id }, data: { isLatest: false } });
  }

  const quote = await prisma.quote.create({
    data: {
      customerId,
      createdById: user.id,
      quoteDate,
      version: (latest?.version ?? 0) + 1,
      isLatest: true,
      operationFee,
      finalMileFee,
      shippingFee: finalMileFee,
      totalAmount: operationFee + finalMileFee,
      notes: String(formData.get("notes") || ""),
    },
  });

  if (attachment instanceof File && attachment.size > 0) {
    const uploadDir = path.join(process.cwd(), "public", "uploads", "quotes");
    await mkdir(uploadDir, { recursive: true });

    const ext = path.extname(attachment.name);
    const savedFileName = `${Date.now()}-${randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, savedFileName);
    const buffer = Buffer.from(await attachment.arrayBuffer());
    await writeFile(filePath, buffer);

    await prisma.quoteAttachment.create({
      data: {
        quoteId: quote.id,
        fileName: attachment.name,
        fileUrl: `/uploads/quotes/${savedFileName}`,
      },
    });
  }

  revalidatePath("/dashboard/quotes");
  revalidatePath(`/dashboard/customers/${customerId}`);
}
