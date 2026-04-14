import { ReactNode } from "react";

export function StatCard({ title, value, extra }: { title: string; value: string | number; extra?: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {extra ? <div className="mt-2 text-xs text-slate-500">{extra}</div> : null}
    </div>
  );
}
