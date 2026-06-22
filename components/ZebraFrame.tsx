import type { ReactNode } from "react";

export function ZebraFrame({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col bg-white text-ink">{children}</div>;
}
