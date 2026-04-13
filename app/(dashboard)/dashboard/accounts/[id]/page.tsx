import { notFound } from "next/navigation";
import { resetPasswordAction, updateAccountAction } from "@/app/actions/account-actions";
import { requireCurrentUser } from "@/lib/current-user";
import { assertAdmin } from "@/lib/admin-guard";
import { assertModuleAccess } from "@/lib/rbac";
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

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-700">
        <p>账号：{targetUser.email}</p>
        <p>创建时间：{targetUser.createdAt.toLocaleString("zh-CN")}</p>
        <p>更新时间：{targetUser.updatedAt.toLocaleString("zh-CN")}</p>
      </div>

      <form action={updateAccountAction} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
        <input type="hidden" name="id" value={targetUser.id} />
        <div className="space-y-1">
          <label className="text-sm text-slate-600">姓名</label>
          <input name="name" defaultValue={targetUser.name} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-600">角色</label>
          <select name="role" defaultValue={targetUser.role.name} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            {roles.map((role) => (
              <option key={role.id} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-600">团队 / 部门</label>
          <input name="teamName" defaultValue={targetUser.teamName ?? ""} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-600">账号状态</label>
          <select name="status" defaultValue={targetUser.status} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="ACTIVE">ACTIVE</option>
            <option value="DISABLED">DISABLED</option>
          </select>
        </div>
        <button className="md:col-span-2 rounded-md bg-slate-900 px-4 py-2 text-sm text-white">保存修改</button>
      </form>

      <form action={resetPasswordAction} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <input type="hidden" name="id" value={targetUser.id} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-72 space-y-1">
            <label className="text-sm text-slate-600">重置密码（轻量版）</label>
            <input
              name="newPassword"
              defaultValue="123456"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <button className="rounded-md border border-amber-300 px-4 py-2 text-sm text-amber-700">重置密码</button>
        </div>
      </form>
    </div>
  );
}
