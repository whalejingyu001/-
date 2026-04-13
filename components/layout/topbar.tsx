"use client";

import { signOut } from "next-auth/react";

export function Topbar({ userName, roleLabel }: { userName: string; roleLabel: string }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div>
        <p className="text-sm text-slate-500">当前角色</p>
        <p className="text-base font-semibold text-slate-900">{roleLabel}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">{userName}</p>
          <p className="text-xs text-slate-500">在线</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          退出登录
        </button>
      </div>
    </header>
  );
}
