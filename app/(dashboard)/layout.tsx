import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { hasTodayClockIn } from "@/lib/attendance";
import { requireCurrentUser } from "@/lib/current-user";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireCurrentUser();
  const checkedIn = await hasTodayClockIn(user.id);

  if (!checkedIn) {
    redirect("/attendance/check-in");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar user={user} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar userName={user.name} roleLabel={user.roleLabel} />
        <main className="ui-admin-shell flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
