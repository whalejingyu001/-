"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("账号或密码错误");
      return;
    }

    router.push("/attendance/check-in");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">FLMAN-CN</h1>
          <p className="text-sm text-slate-500">企业内部管理系统登录</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-700" htmlFor="email">
            邮箱
          </label>
          <input id="email" name="email" type="email" className="w-full rounded-md border border-slate-300 px-3 py-2" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-700" htmlFor="password">
            密码
          </label>
          <input id="password" name="password" type="password" className="w-full rounded-md border border-slate-300 px-3 py-2" required />
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <button type="submit" disabled={loading} className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50">
          {loading ? "登录中..." : "登录"}
        </button>
        <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-500">
          演示账号：admin@flman.cn / manager@flman.cn / sales1@flman.cn / finance@flman.cn，密码统一 123456
        </div>
      </form>
    </div>
  );
}
