"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function createReimbursementAction(formData: FormData) {
  const user = await requireCurrentUser();
  const amount = Number(formData.get("amount") || 0);
  const reason = String(formData.get("reason") || "");

  await prisma.reimbursement.create({
    data: {
      applicantId: user.id,
      amount,
      reason,
      status: "PENDING",
    },
  });

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

  await prisma.reimbursement.update({
    where: { id },
    data: {
      status: status === "APPROVED" ? "APPROVED" : "REJECTED",
      reviewerId: user.id,
      reviewNote: String(formData.get("reviewNote") || ""),
    },
  });

  revalidatePath("/dashboard/finance");
}
