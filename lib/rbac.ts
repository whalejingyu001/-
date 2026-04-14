import { notFound } from "next/navigation";
import type { CurrentUser } from "@/lib/current-user";

export type ModuleKey =
  | "dashboard"
  | "attendance"
  | "field-work-board"
  | "customers"
  | "quotes"
  | "orders"
  | "revenue"
  | "finance"
  | "meetings"
  | "supervision"
  | "accounts"
  | "system-settings";

const permissions: Record<CurrentUser["role"], ModuleKey[]> = {
  SALES: ["dashboard", "attendance", "customers", "quotes", "orders", "revenue", "meetings", "finance", "supervision"],
  SALES_MANAGER: ["dashboard", "attendance", "field-work-board", "customers", "quotes", "orders", "revenue", "meetings", "finance", "supervision"],
  FINANCE: ["dashboard", "quotes", "revenue", "finance"],
  ADMIN: [
    "dashboard",
    "attendance",
    "field-work-board",
    "customers",
    "quotes",
    "orders",
    "revenue",
    "finance",
    "meetings",
    "supervision",
    "accounts",
    "system-settings",
  ],
};

export function canAccessModule(role: CurrentUser["role"], module: ModuleKey) {
  return permissions[role].includes(module);
}

export function assertModuleAccess(user: CurrentUser, module: ModuleKey) {
  if (!canAccessModule(user.role, module)) {
    notFound();
  }
}
