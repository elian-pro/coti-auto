import type { ReactNode } from "react";

export function ZebraFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-ink text-bone">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-6 sm:px-10 sm:py-10">
        {children}
      </div>
    </div>
  );
}
