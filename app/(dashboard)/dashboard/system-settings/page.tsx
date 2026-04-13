import { requireCurrentUser } from "@/lib/current-user";
import { assertModuleAccess } from "@/lib/rbac";
import { assertAdmin } from "@/lib/admin-guard";

export default async function SystemSettingsPage() {
  const user = await requireCurrentUser();
  assertModuleAccess(user, "system-settings");
  assertAdmin(user);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">系统设置</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        当前版本为轻量占位页，可在后续迭代中扩展系统参数、字典和通知策略。
      </div>
    </div>
  );
}
