"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { RoleName, UserStatus } from "@prisma/client";
import { requireCurrentUser } from "@/lib/current-user";
import { assertAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

function parseRole(value: string): RoleName {
  if (value === "SALES" || value === "SALES_MANAGER" || value === "FINANCE" || value === "ADMIN") {
    return value;
  }
  return "SALES";
}

function parseStatus(value: string): UserStatus {
  return value === "DISABLED" ? "DISABLED" : "ACTIVE";
}

export async function createAccountAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  assertAdmin(currentUser);

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const roleName = parseRole(String(formData.get("role") || "SALES"));
  const teamName = String(formData.get("teamName") || "").trim() || null;

  if (!name || !email || !password) {
    throw new Error("请完整填写必填字段");
  }

  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    throw new Error("角色不存在");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("该邮箱已存在");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      roleId: role.id,
      teamName,
      status: "ACTIVE",
    },
  });

  revalidatePath("/dashboard/accounts");
}

export async function updateAccountAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  assertAdmin(currentUser);

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const roleName = parseRole(String(formData.get("role") || "SALES"));
  const teamName = String(formData.get("teamName") || "").trim() || null;
  const status = parseStatus(String(formData.get("status") || "ACTIVE"));

  if (!id || !name) {
    throw new Error("参数缺失");
  }

  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    throw new Error("角色不存在");
  }

  if (id === currentUser.id && status === "DISABLED") {
    throw new Error("不能停用当前管理员账号");
  }
  if (id === currentUser.id && roleName !== "ADMIN") {
    throw new Error("不能将当前登录管理员角色改为非管理员");
  }

  await prisma.user.update({
    where: { id },
    data: {
      name,
      roleId: role.id,
      teamName,
      status,
    },
  });

  revalidatePath("/dashboard/accounts");
  revalidatePath(`/dashboard/accounts/${id}`);
}

export async function toggleAccountStatusAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  assertAdmin(currentUser);

  const id = String(formData.get("id") || "");
  const status = parseStatus(String(formData.get("status") || "ACTIVE"));

  if (!id) {
    throw new Error("缺少账号ID");
  }

  if (id === currentUser.id && status === "DISABLED") {
    throw new Error("不能停用当前管理员账号");
  }

  await prisma.user.update({ where: { id }, data: { status } });

  revalidatePath("/dashboard/accounts");
  revalidatePath(`/dashboard/accounts/${id}`);
}

export async function resetPasswordAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  assertAdmin(currentUser);

  const id = String(formData.get("id") || "");
  const newPassword = String(formData.get("newPassword") || "123456");

  if (!id) {
    throw new Error("缺少账号ID");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  revalidatePath("/dashboard/accounts");
  revalidatePath(`/dashboard/accounts/${id}`);
}

export async function deleteAccountAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  assertAdmin(currentUser);

  const id = String(formData.get("id") || "");
  if (!id) {
    throw new Error("缺少账号ID");
  }
  if (id === currentUser.id) {
    throw new Error("不能删除当前登录管理员账号");
  }
}
