import Link from "next/link";
import { CurrentUser } from "@/lib/current-user";
import { canAccessModule, ModuleKey } from "@/lib/rbac";

const items: Array<{ key: ModuleKey; href: string; label: string }> = [
  { key: "dashboard", href: "/dashboard", label: "首页" },
  { key: "attendance", href: "/dashboard/attendance", label: "打卡记录管理" },
  { key: "customers", href: "/dashboard/customers", label: "客户中心" },
  { key: "quotes", href: "/dashboard/quotes", label: "报价模块" },
  { key: "orders", href: "/dashboard/order-stats", label: "订单数量监控" },
  { key: "revenue", href: "/dashboard/revenue", label: "收入统计" },
  { key: "finance", href: "/dashboard/finance", label: "财务中心" },
  { key: "meetings", href: "/dashboard/meetings", label: "智能会议记录" },
  { key: "supervision", href: "/dashboard/supervision", label: "监督中心" },
  { key: "accounts", href: "/dashboard/accounts", label: "账户与权限" },
  { key: "system-settings", href: "/dashboard/system-settings", label: "系统设置" },
];

export function Sidebar({ user }: { user: CurrentUser }) {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-slate-900 text-white">
      <div className="border-b border-slate-800 px-5 py-5">
        <p className="text-xl font-bold">FLMAN-CN</p>
        <p className="text-xs text-slate-300">企业内部业务管理系统</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items
          .filter((item) => canAccessModule(user.role, item.key))
          .map((item) => (
            <Link key={item.href} href={item.href} className="block rounded-md px-3 py-2 text-sm text-slate-100 hover:bg-slate-800">
              {item.label}
            </Link>
          ))}
      </nav>
      <div className="border-t border-slate-800 p-4 text-xs text-slate-300">版本 v0.1.0</div>
    </aside>
  );
}
