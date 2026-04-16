import Link from "next/link";
import { RoleName, UserStatus } from "@prisma/client";
import { createAccountAction } from "@/app/actions/account-actions";
import { AccountRowActions } from "@/components/accounts/account-row-actions";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireCurrentUser } from "@/lib/current-user";
import { assertModuleAccess } from "@/lib/rbac";
import { assertAdmin } from "@/lib/admin-guard";
import { USER_STATUS_LABELS } from "@/lib/enum-labels";
import { prisma } from "@/lib/prisma";

const ROLE_HELPERS: Record<RoleName, string> = {
  SALES: "销售：负责客户、跟进、报价、单量",
  SALES_MANAGER: "销售主管：查看团队数据",
  FINANCE: "财务：查看财务中心、报销审核、收入统计",
  ADMIN: "管理员：可访问全部模块并管理账号权限",
};

function withParams(base: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(base).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    params.set(key, String(value));
  });
  return `?${params.toString()}`;
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{
    keyword?: string;
    role?: string;
    status?: string;
    teamName?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "accounts");
  assertAdmin(user);
  const params = await searchParams;

  const keyword = (params.keyword ?? "").trim();
  const roleFilter = (params.role ?? "") as "" | RoleName;
  const statusFilter = (params.status ?? "") as "" | UserStatus;
  const teamNameFilter = (params.teamName ?? "").trim();
  const pageSize = params.pageSize === "20" ? 20 : 10;
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const where = {
    ...(keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: "insensitive" as const } },
            { email: { contains: keyword, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(roleFilter ? { role: { name: roleFilter } } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(teamNameFilter ? { teamName: teamNameFilter } : {}),
  };

  const [roles, teams, total, users] = await Promise.all([
    prisma.role.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({
      where: { teamName: { not: null } },
      select: { teamName: true },
      distinct: ["teamName"],
      orderBy: { teamName: "asc" },
    }),
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: { role: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const queryBase = { keyword, role: roleFilter, status: statusFilter, teamName: teamNameFilter, pageSize };
  const roleForCreate = roleFilter || "SALES";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">账户与权限</h1>

      <form action={createAccountAction} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6">
        <input name="name" placeholder="姓名" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        <input name="email" type="email" placeholder="邮箱/登录账号" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        <input name="password" placeholder="初始密码" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        <div className="space-y-1">
          <select name="role" defaultValue={roleForCreate} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required>
            {roles.map((role) => (
              <option key={role.id} value={role.name}>
                {role.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">{ROLE_HELPERS[roleForCreate]}</p>
        </div>
        <input name="teamName" placeholder="所属团队/部门（可选）" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <SubmitButton pendingText="创建中..." className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
          新建账号
        </SubmitButton>
        <div className="md:col-span-6 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p>销售：负责客户、跟进、报价、单量</p>
          <p>销售主管：查看团队数据</p>
          <p>财务：查看财务中心、报销审核、收入统计</p>
          <p>管理员：可访问全部模块并管理账号权限</p>
        </div>
      </form>

      <form method="get" className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6">
        <input
          name="keyword"
          defaultValue={keyword}
          placeholder="按姓名或邮箱搜索"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
        />
        <select name="role" defaultValue={roleFilter} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">全部角色</option>
          {roles.map((role) => (
            <option key={role.id} value={role.name}>
              {role.label}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={statusFilter} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">全部状态</option>
          <option value="ACTIVE">启用</option>
          <option value="DISABLED">停用</option>
        </select>
        <select name="teamName" defaultValue={teamNameFilter} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">全部团队/部门</option>
          {teams
            .map((item) => item.teamName)
            .filter((item): item is string => Boolean(item))
            .map((teamName) => (
              <option key={teamName} value={teamName}>
                {teamName}
              </option>
            ))}
        </select>
        <div className="flex items-center gap-2">
          <select name="pageSize" defaultValue={String(pageSize)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
            <option value="10">10/页</option>
            <option value="20">20/页</option>
          </select>
          <SubmitButton pendingText="筛选中..." className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
            筛选
          </SubmitButton>
        </div>
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
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3">{item.email}</td>
                  <td className="px-4 py-3">{item.role.label}</td>
                  <td className="px-4 py-3">{item.teamName ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Badge text={USER_STATUS_LABELS[item.status]} variant={item.status === "ACTIVE" ? "success" : "danger"} />
                  </td>
                  <td className="px-4 py-3">{item.createdAt.toLocaleString("zh-CN")}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/dashboard/accounts/${item.id}`} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">
                        详情/编辑
                      </Link>
                      <AccountRowActions userId={item.id} status={item.status} isSelf={item.id === user.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  暂无符合条件的账号
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <p className="text-slate-600">
          共 {total} 条，当前第 {safePage}/{totalPages} 页
        </p>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/accounts${withParams({ ...queryBase, page: Math.max(1, safePage - 1) })}`}
            className={`rounded-md border px-3 py-1 ${safePage <= 1 ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700"}`}
          >
            上一页
          </Link>
          <Link
            href={`/dashboard/accounts${withParams({ ...queryBase, page: Math.min(totalPages, safePage + 1) })}`}
            className={`rounded-md border px-3 py-1 ${safePage >= totalPages ? "pointer-events-none border-slate-200 text-slate-300" : "border-slate-300 text-slate-700"}`}
          >
            下一页
          </Link>
        </div>
      </div>
    </div>
  );
}
