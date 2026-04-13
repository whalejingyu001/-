import { redirect } from "next/navigation";
import { hasTodayClockIn } from "@/lib/attendance";
import { requireCurrentUser } from "@/lib/current-user";

export default async function Home() {
  const user = await requireCurrentUser();
  const checkedIn = await hasTodayClockIn(user.id);
  redirect(checkedIn ? "/dashboard" : "/attendance/check-in");
}
