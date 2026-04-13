import { ReactNode } from "react";

export function StatCard({ title, value, extra }: { title: string; value: string | number; extra?: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {extra ? <div className="mt-2 text-xs text-slate-500">{extra}</div> : null}
    </div>
  );
}
