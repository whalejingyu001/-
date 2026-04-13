import Link from "next/link";
import { createAccountAction, resetPasswordAction, toggleAccountStatusAction } from "@/app/actions/account-actions";
import { requireCurrentUser } from "@/lib/current-user";
import { assertModuleAccess } from "@/lib/rbac";
import { assertAdmin } from "@/lib/admin-guard";
import { USER_STATUS_LABELS } from "@/lib/enum-labels";
import { prisma } from "@/lib/prisma";

export default async function AccountsPage() {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "accounts");
  assertAdmin(user);

  const [roles, users] = await Promise.all([
    prisma.role.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">账户与权限</h1>

      <form action={createAccountAction} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6">
        <input name="name" placeholder="姓名" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        <input name="email" type="email" placeholder="邮箱/登录账号" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        <input name="password" placeholder="初始密码" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        <select name="role" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required>
          {roles.map((role) => (
            <option key={role.id} value={role.name}>
              {role.label}
            </option>
          ))}
        </select>
        <input name="teamName" placeholder="所属团队/部门（可选）" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">新建账号</button>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">姓名</th>
              <th className="px-4 py-3 text-left">邮箱 / 登录账号</th>
              <th className="px-4 py-3 text-left">角色</th>
              <th className="px-4 py-3 text-left">所属团队 / 部门</th>
              <th className="px-4 py-3 text-left">账号状态</th>
              <th className="px-4 py-3 text-left">创建时间</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((item) => {
              const nextStatus = item.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3">{item.email}</td>
                  <td className="px-4 py-3">{item.role.label}</td>
                  <td className="px-4 py-3">{item.teamName ?? "-"}</td>
                  <td className="px-4 py-3">{USER_STATUS_LABELS[item.status]}</td>
                  <td className="px-4 py-3">{item.createdAt.toLocaleString("zh-CN")}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/dashboard/accounts/${item.id}`} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">
                        查看详情
                      </Link>
                      <form action={toggleAccountStatusAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="status" value={nextStatus} />
                        <button className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">
                          {item.status === "ACTIVE" ? "停用" : "启用"}
                        </button>
                      </form>
                      <form action={resetPasswordAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="newPassword" value="123456" />
                        <button className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-700">重置密码</button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
