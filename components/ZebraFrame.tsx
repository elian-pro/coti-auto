import type { ReactNode } from "react";

export function ZebraFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bone">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 zebra-bg opacity-[0.07]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-3 zebra-bar"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3 zebra-bar"
      />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10 sm:px-10">
        {children}
      </div>
    </div>
  );
}
