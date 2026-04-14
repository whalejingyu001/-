import { notFound } from "next/navigation";
import { AccountEditForm } from "@/components/accounts/account-edit-form";
import { Badge } from "@/components/ui/badge";
import { requireCurrentUser } from "@/lib/current-user";
import { assertAdmin } from "@/lib/admin-guard";
import { assertModuleAccess } from "@/lib/rbac";
import { USER_STATUS_LABELS } from "@/lib/enum-labels";
import { prisma } from "@/lib/prisma";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "accounts");
  assertAdmin(user);

  const { id } = await params;
  const [roles, targetUser] = await Promise.all([
    prisma.role.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.user.findUnique({ where: { id }, include: { role: true } }),
  ]);

  if (!targetUser) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">账号详情 / 编辑</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-700">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">基本信息</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <p>账号：{targetUser.email}</p>
          <p>
            状态：
            <span className="ml-2">
              <Badge text={USER_STATUS_LABELS[targetUser.status]} variant={targetUser.status === "ACTIVE" ? "success" : "danger"} />
            </span>
          </p>
          <p>创建时间：{targetUser.createdAt.toLocaleString("zh-CN")}</p>
          <p>更新时间：{targetUser.updatedAt.toLocaleString("zh-CN")}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">权限信息</h2>
        <AccountEditForm targetUser={targetUser} roles={roles} isSelf={targetUser.id === user.id} />
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        <h2 className="font-semibold">安全操作</h2>
        <p className="mt-2">已启用保护规则：当前登录管理员不能停用自己、不能将自己降级为非管理员、不能删除自己。</p>
      </section>
    </div>
  );
}
