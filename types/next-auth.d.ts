declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      roleLabel: string;
      name?: string | null;
      email?: string | null;
    };
  }

  interface User {
    role?: string;
    roleLabel?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: string;
    roleLabel?: string;
  }
}
