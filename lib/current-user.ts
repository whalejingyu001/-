import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "SALES" | "SALES_MANAGER" | "FINANCE" | "ADMIN";
  roleLabel: string;
  teamName?: string | null;
  status: "ACTIVE" | "DISABLED";
};

export async function requireCurrentUser(): Promise<CurrentUser> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true },
  });

  if (!dbUser) {
    redirect("/login");
  }

  if (dbUser.status !== "ACTIVE") {
    redirect("/login");
  }

  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role.name,
    roleLabel: dbUser.role.label,
    teamName: dbUser.teamName,
    status: dbUser.status,
  };
}
