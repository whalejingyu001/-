"use server";

import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";
import { OrderImportSource } from "@prisma/client";
import { requireCurrentUser } from "@/lib/current-user";
import { getAccessibleOwnerIds } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

export async function upsertOrderStatAction(formData: FormData) {
  const user = await requireCurrentUser();
  const customerId = String(formData.get("customerId") || "");
  const orderCount = Number(formData.get("orderCount") || 0);

  const ownerIds = await getAccessibleOwnerIds(user);
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      ...(ownerIds ? { ownerId: { in: ownerIds } } : {}),
    },
  });

  if (!customer) {
    throw new Error("无权限记录该客户单量");
  }

  const today = startOfDay(new Date());

  await prisma.customerOrderStat.upsert({
    where: { customerId_statDate: { customerId, statDate: today } },
    update: { orderCount },
    create: { customerId, statDate: today, orderCount },
  });

  revalidatePath("/dashboard/order-stats");
  revalidatePath("/dashboard/revenue");
  revalidatePath("/dashboard");
}

const ORDER_IMPORT_SOURCES: OrderImportSource[] = ["WMS_A", "WMS_B", "OVERSEAS_DAILY", "MANUAL_TEMPLATE"];

type ImportPreviewRow = {
  rowNo: number;
  customerName: string;
  customerCode?: string;
  statDate: string;
  orderCount: number;
  orderNo?: string;
  warehouseSource?: string;
  mappedCustomerId?: string;
};

export async function confirmOrderImportAction(formData: FormData) {
  const user = await requireCurrentUser();
  const source = String(formData.get("source") || "") as OrderImportSource;
  const fileName = String(formData.get("fileName") || "unknown-file");
  const rowsJson = String(formData.get("rowsJson") || "[]");

  if (!ORDER_IMPORT_SOURCES.includes(source)) {
    throw new Error("导入来源不合法");
  }

  let rows: ImportPreviewRow[] = [];
  try {
    rows = JSON.parse(rowsJson) as ImportPreviewRow[];
  } catch {
    throw new Error("导入数据格式错误");
  }

  if (!rows.length) {
    throw new Error("没有可导入的数据行");
  }

  const ownerIds = await getAccessibleOwnerIds(user);
  const customers = await prisma.customer.findMany({
    where: ownerIds ? { ownerId: { in: ownerIds } } : {},
    select: { id: true, name: true },
  });
  const customerNameMap = new Map(customers.map((item) => [item.name.trim().toLowerCase(), item.id]));
  const customerIdSet = new Set(customers.map((item) => item.id));

  const batch = await prisma.orderImportBatch.create({
    data: {
      source,
      fileName,
      importedById: user.id,
      status: "FAILED",
    },
  });

  const rowData: Array<{
    batchId: string;
    rawCustomerName: string;
    rawCustomerCode?: string;
    orderDate: Date;
    orderCount: number;
    orderNo?: string;
    warehouseSource?: string;
    customerId?: string;
    errorMessage?: string;
  }> = [];
  const aggregate = new Map<string, { customerId: string; statDate: Date; orderCount: number }>();
  let successCount = 0;
  let failedCount = 0;

  for (const row of rows) {
    const rawName = (row.customerName ?? "").trim();
    const statDate = new Date(row.statDate);
    const orderCount = Number(row.orderCount);

    let customerId = "";
    if (row.mappedCustomerId && customerIdSet.has(row.mappedCustomerId)) {
      customerId = row.mappedCustomerId;
    } else {
      customerId = customerNameMap.get(rawName.toLowerCase()) ?? "";
    }

    let errorMessage = "";
    if (!rawName) {
      errorMessage = "客户名称为空";
    } else if (!customerId) {
      errorMessage = "未匹配到系统客户";
    } else if (Number.isNaN(statDate.getTime())) {
      errorMessage = "日期格式错误";
    } else if (!Number.isFinite(orderCount) || orderCount < 0) {
      errorMessage = "单量不合法";
    }

    if (errorMessage) {
      failedCount += 1;
    } else {
      successCount += 1;
      const day = startOfDay(statDate);
      const key = `${customerId}_${day.toISOString()}`;
      const existing = aggregate.get(key);
      if (existing) {
        existing.orderCount += orderCount;
      } else {
        aggregate.set(key, { customerId, statDate: day, orderCount });
      }
    }

    rowData.push({
      batchId: batch.id,
      rawCustomerName: rawName || `第${row.rowNo}行`,
      rawCustomerCode: row.customerCode || undefined,
      orderDate: Number.isNaN(statDate.getTime()) ? new Date() : startOfDay(statDate),
      orderCount: Number.isFinite(orderCount) ? Math.max(0, Math.floor(orderCount)) : 0,
      orderNo: row.orderNo || undefined,
      warehouseSource: row.warehouseSource || undefined,
      customerId: customerId || undefined,
      errorMessage: errorMessage || undefined,
    });
  }

  await prisma.$transaction(async (tx) => {
    if (rowData.length) {
      await tx.orderImportRow.createMany({ data: rowData });
    }

    for (const item of aggregate.values()) {
      await tx.customerOrderStat.upsert({
        where: {
          customerId_statDate: {
            customerId: item.customerId,
            statDate: item.statDate,
          },
        },
        update: { orderCount: { increment: item.orderCount } },
        create: {
          customerId: item.customerId,
          statDate: item.statDate,
          orderCount: item.orderCount,
        },
      });
    }

    await tx.orderImportBatch.update({
      where: { id: batch.id },
      data: {
        successCount,
        failedCount,
        status: failedCount === 0 ? "SUCCESS" : successCount === 0 ? "FAILED" : "PARTIAL",
      },
    });
  });

  revalidatePath("/dashboard/order-stats");
  revalidatePath("/dashboard/order-stats/import");
  revalidatePath("/dashboard/order-stats/import-logs");
  revalidatePath("/dashboard/revenue");
  revalidatePath("/dashboard");

  return {
    ok: true,
    batchId: batch.id,
    successCount,
    failedCount,
  };
}
