"use client";

import { FormEvent, useState } from "react";

type Props = {
  token: string;
  userName: string;
  userEmail: string;
  defaultType?: "CLOCK_IN" | "CLOCK_OUT" | "FIELD_WORK";
};

const TYPE_OPTIONS = [
  { value: "CLOCK_IN", label: "上班打卡" },
  { value: "CLOCK_OUT", label: "下班打卡" },
  { value: "FIELD_WORK", label: "外勤打卡" },
] as const;

export function MobileAttendanceForm({ token, userName, userEmail, defaultType = "CLOCK_IN" }: Props) {
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]["value"]>(defaultType);
  const [loading, setLoading] = useState(false);
  const [locationText, setLocationText] = useState("未获取定位");
  const [message, setMessage] = useState("");
  const [remark, setRemark] = useState("");
  const [images, setImages] = useState<File[]>([]);

  async function toDataUrls(files: File[]) {
    const tasks = files.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(new Error("图片读取失败"));
          reader.readAsDataURL(file);
        }),
    );
    return Promise.all(tasks);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    if (!navigator.geolocation) {
      setMessage("当前浏览器不支持定位。");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (position.coords.accuracy > 100) {
          setMessage("定位不准确，请重新获取");
          setLoading(false);
          return;
        }

        let imagePayload: string[] = [];
        if (type === "FIELD_WORK") {
          if (!remark.trim()) {
            setMessage("请填写外勤说明");
            setLoading(false);
            return;
          }
          if (images.length === 0) {
            setMessage("外勤打卡必须上传至少 1 张现场照片");
            setLoading(false);
            return;
          }
          try {
            imagePayload = await toDataUrls(images);
          } catch {
            setMessage("图片读取失败，请重新选择照片后再试");
            setLoading(false);
            return;
          }
        }

        const payload = {
          token,
          type,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          images: imagePayload,
          remark: remark.trim() || undefined,
        };
        setLocationText(`已定位：${payload.latitude.toFixed(6)}, ${payload.longitude.toFixed(6)}（±${Math.round(payload.accuracy)}m）`);

        const response = await fetch("/api/attendance/mobile-checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => null);
        if (!response.ok) {
          setMessage(data?.error ?? "打卡失败，请稍后重试。");
          setLoading(false);
          return;
        }

        setMessage("打卡成功，请返回电脑端等待自动放行。");
        setLoading(false);
      },
      (error) => {
        setMessage(`定位失败：${error.message}`);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-slate-50 px-4 py-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">移动端打卡</h1>
        <p className="mt-1 text-sm text-slate-600">{userName}（{userEmail}）</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block text-sm text-slate-700">打卡类型</label>
          <select value={type} onChange={(event) => setType(event.target.value as typeof type)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            {TYPE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">{locationText}</p>

          {type === "FIELD_WORK" ? (
            <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <label className="block text-sm text-slate-700">上传现场照片（至少 1 张）</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  setImages(Array.from(event.target.files ?? []));
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="text-xs text-slate-500">已选择 {images.length} 张</p>

              <label className="block text-sm text-slate-700">外勤说明（必填）</label>
              <textarea
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                placeholder="请填写本次外勤内容，例如：客户拜访、仓库巡检、现场交接等"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
          ) : null}

          <button disabled={loading} className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">
            {loading ? "定位并提交中..." : "获取定位并提交打卡"}
          </button>
        </form>

        {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
      </div>
    </div>
  );
}
