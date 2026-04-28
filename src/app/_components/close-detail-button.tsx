"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function CloseDetailButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const close = () => {
    const sp = new URLSearchParams(searchParams);
    sp.delete("apt");
    startTransition(() => router.push(sp.toString() ? `/?${sp.toString()}` : "/"));
  };

  return (
    <button
      type="button"
      onClick={close}
      aria-label="상세 닫기"
      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      ✕
    </button>
  );
}
