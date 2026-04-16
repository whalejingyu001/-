"use client";

import { resetPasswordAction, toggleAccountStatusAction } from "@/app/actions/account-actions";
import { SubmitButton } from "@/components/ui/submit-button";

type Props = {
  userId: string;
  status: "ACTIVE" | "DISABLED";
  isSelf: boolean;
};

export function AccountRowActions({ userId, status, isSelf }: Props) {
  const nextStatus = status === "ACTIVE" ? "DISABLED" : "ACTIVE";

  return (
    <div className="flex flex-wrap gap-2">
      <form
        action={toggleAccountStatusAction}
        onSubmit={(event) => {
          const ok = window.confirm(
            status === "ACTIVE"
              ? "确认停用该账号？停用后该用户将无法登录系统。"
              : "确认启用该账号？启用后该用户可重新登录系统。",
          );
          if (!ok) event.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={userId} />
        <input type="hidden" name="status" value={nextStatus} />
        <SubmitButton
          pendingText="处理中..."
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
          disabled={isSelf && status === "ACTIVE"}
        >
          {status === "ACTIVE" ? "停用" : "启用"}
        </SubmitButton>
      </form>
      <form
        action={resetPasswordAction}
        onSubmit={(event) => {
          const ok = window.confirm("确认将该账号密码重置为默认密码 123456 吗？");
          if (!ok) event.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={userId} />
        <input type="hidden" name="newPassword" value="123456" />
        <SubmitButton pendingText="重置中..." className="rounded border border-amber-300 px-2 py-1 text-xs text-amber-700">
          重置密码
        </SubmitButton>
      </form>
    </div>
  );
}
