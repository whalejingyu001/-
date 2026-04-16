"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children"> & {
  children: ReactNode;
  pendingText?: string;
};

export function SubmitButton({
  children,
  pendingText = "处理中...",
  className = "",
  disabled,
  ...rest
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = pending || Boolean(disabled);

  return (
    <button type="submit" disabled={isDisabled} aria-busy={pending} className={className} {...rest}>
      <span className="inline-flex items-center gap-2">
        {pending ? (
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        ) : null}
        {pending ? pendingText : children}
      </span>
    </button>
  );
}
