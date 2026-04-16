"use client";

import { useState } from "react";
import type { RoleName, UserStatus } from "@prisma/client";
import { resetPasswordAction, updateAccountAction } from "@/app/actions/account-actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { USER_STATUS_LABELS } from "@/lib/enum-labels";

type RoleOption = {
  id: string;
  name: RoleName;
  label: string;
};

type TargetUser = {
  id: string;
  name: string;
  role: { name: RoleName };
  teamName: string | null;
  status: UserStatus;
};

const ROLE_HELPERS: Record<RoleName, string> = {
  SALES: "销售：负责客户、跟进、报价、单量",
  SALES_MANAGER: "销售主管：查看团队数据",
  FINANCE: "财务：查看财务中心、报销审核、收入统计",
  ADMIN: "管理员：可访问全部模块并管理账号权限",
};

export function AccountEditForm({
  targetUser,
  roles,
  isSelf,
}: {
  targetUser: TargetUser;
  roles: RoleOption[];
  isSelf: boolean;
}) {
  const [role, setRole] = useState<RoleName>(targetUser.role.name);
  const [status, setStatus] = useState<UserStatus>(targetUser.status);

  return (
    <>
      <form
        action={updateAccountAction}
        onSubmit={(event) => {
          if (isSelf && role !== "ADMIN") {
            event.preventDefault();
            window.alert("不能将当前登录管理员的角色改为非管理员。");
            return;
          }
          if (isSelf && status === "DISABLED") {
            event.preventDefault();
            window.alert("不能停用当前登录管理员账号。");
            return;
          }
          if (role !== targetUser.role.name) {
            const ok = window.confirm("确认修改该账号角色吗？角色变更会立即影响可访问模块。");
            if (!ok) {
              event.preventDefault();
              return;
            }
          }
        }}
        className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2"
      >
        <input type="hidden" name="id" value={targetUser.id} />
        <div className="space-y-1">
          <label className="text-sm text-slate-600">姓名</label>
          <input name="name" defaultValue={targetUser.name} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-600">角色</label>
          <select
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value as RoleName)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {roles.map((roleOption) => (
              <option key={roleOption.id} value={roleOption.name}>
                {roleOption.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">{ROLE_HELPERS[role]}</p>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-600">团队 / 部门</label>
          <input name="teamName" defaultValue={targetUser.teamName ?? ""} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-600">账号状态</label>
          <select
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as UserStatus)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ACTIVE">{USER_STATUS_LABELS.ACTIVE}</option>
            <option value="DISABLED">{USER_STATUS_LABELS.DISABLED}</option>
          </select>
        </div>
        <SubmitButton pendingText="保存中..." className="md:col-span-2 rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
          保存修改
        </SubmitButton>
      </form>

      <form
        action={resetPasswordAction}
        onSubmit={(event) => {
          const ok = window.confirm("确认重置该账号密码？默认重置为 123456。");
          if (!ok) event.preventDefault();
        }}
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
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
          <SubmitButton pendingText="重置中..." className="rounded-md border border-amber-300 px-4 py-2 text-sm text-amber-700">
            重置密码
          </SubmitButton>
        </div>
      </form>
    </>
  );
}
