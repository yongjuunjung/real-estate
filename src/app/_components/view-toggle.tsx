"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { ViewMode } from "@/lib/filter-params";

const options: { value: ViewMode; label: string }[] = [
  { value: "apt", label: "단지별" },
  { value: "tx", label: "거래별" },
  { value: "map", label: "지도" },
];

export function ViewToggle({ current }: { current: ViewMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const switchTo = (mode: ViewMode) => {
    if (mode === current) return;
    const sp = new URLSearchParams(searchParams);
    if (mode === "apt") sp.delete("view");
    else sp.set("view", mode);
    sp.delete("page");
    startTransition(() => router.push(`/?${sp.toString()}`));
  };

  return (
    <div className="flex rounded border border-border p-0.5 text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => switchTo(opt.value)}
          className={`rounded px-2.5 py-1 ${current === opt.value ? "bg-foreground text-background" : "hover:bg-accent"}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
