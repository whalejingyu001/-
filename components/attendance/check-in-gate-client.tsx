"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  token: string;
  mobileUrl: string;
  expiresAt: string;
};

export function CheckInGateClient({ token, mobileUrl, expiresAt }: Props) {
  const router = useRouter();
  const [statusText, setStatusText] = useState("等待扫码打卡...");
  const [expired, setExpired] = useState(false);

  const qrImageUrl = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(mobileUrl)}`,
    [mobileUrl],
  );

  useEffect(() => {
    const expiredAtTs = new Date(expiresAt).getTime();
    const timer = setInterval(async () => {
      if (Date.now() > expiredAtTs) {
        setExpired(true);
        setStatusText("二维码已过期，请刷新页面重新获取。");
        return;
      }

      const response = await fetch(`/api/attendance/token-status?token=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as { done: boolean; message?: string };
      if (data.done) {
        setStatusText("打卡成功，正在进入系统...");
        router.replace("/dashboard");
        router.refresh();
      } else {
        setStatusText(data.message ?? "等待扫码打卡...");
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [expiresAt, router, token]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <img src={qrImageUrl} alt="打卡二维码" className="mx-auto h-56 w-56 rounded-md border border-slate-200" />
        <p className="mt-3 text-center text-xs text-slate-500">二维码有效期至：{new Date(expiresAt).toLocaleString("zh-CN")}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        <p>{statusText}</p>
        {expired ? null : (
          <p className="mt-2 break-all text-xs text-slate-500">
            无法扫码可手动打开：<a href={mobileUrl} className="underline">{mobileUrl}</a>
          </p>
        )}
      </div>
    </div>
  );
}

