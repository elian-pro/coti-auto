import { ZebraLogo } from "./ZebraLogo";

export function Footer() {
  return (
    <footer className="bg-ink py-10 text-white/70">
      <div className="container-x flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-3 text-white">
          <ZebraLogo className="h-4 w-auto" />
          <span className="eyebrow !text-white/60">Coti Auto</span>
        </div>
        <span
          className="text-xs text-white/50"
          style={{ fontFamily: "var(--font-mono), ui-monospace, monospace" }}
        >
          build {process.env.NEXT_PUBLIC_BUILD_TAG ?? "dev"}
        </span>
      </div>
    </footer>
  );
}
