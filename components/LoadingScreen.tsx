export function LoadingScreen({ account }: { account: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 py-16">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-ink">
          <div className="absolute inset-0 zebra-bar animate-zebra-slide" aria-hidden />
        </div>
        <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-ink">
          <div className="absolute inset-0 zebra-bar animate-zebra-slide [animation-direction:reverse]" aria-hidden />
        </div>
        <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-ink">
          <div className="absolute inset-0 zebra-bar animate-zebra-slide" aria-hidden />
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-ink/60">Generando cotización</p>
        <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">
          {account || "Cuenta sin nombre"}
        </h2>
        <p className="mt-3 max-w-md text-sm text-ink/70">
          Estamos transcribiendo la junta, extrayendo requisitos y armando el PDF.
          Esto puede tardar hasta un par de minutos.
        </p>
      </div>

      <div className="w-full max-w-xl overflow-hidden rounded-full border-2 border-ink">
        <div className="h-3 zebra-bar animate-zebra-slide" aria-hidden />
      </div>

      <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs uppercase tracking-widest text-ink/70">
        <li className="animate-stripe-pulse">Leyendo junta</li>
        <li className="animate-stripe-pulse [animation-delay:200ms]">Analizando</li>
        <li className="animate-stripe-pulse [animation-delay:400ms]">Cotizando</li>
        <li className="animate-stripe-pulse [animation-delay:600ms]">Exportando</li>
      </ul>
    </div>
  );
}
