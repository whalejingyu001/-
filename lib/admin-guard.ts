import { notFound } from "next/navigation";
import type { CurrentUser } from "@/lib/current-user";

export function assertAdmin(user: CurrentUser) {
  if (user.role !== "ADMIN") {
    notFound();
  }
}
