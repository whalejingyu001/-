import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-rose-100 text-rose-700",
  info: "bg-blue-100 text-blue-700",
  progress: "bg-blue-100 text-blue-700",
};

export function Badge({ text, variant = "default" }: { text: string; variant?: keyof typeof variants }) {
  return <span className={cn("rounded-full px-2 py-1 text-xs font-medium", variants[variant])}>{text}</span>;
}
