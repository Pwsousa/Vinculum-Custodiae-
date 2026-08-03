import { Link } from "react-router-dom";

export function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-primary-foreground/40 text-[11px] font-semibold">
              CI
            </span>
            <span className="text-sm font-semibold">Cadeia de Custódia Interinstitucional</span>
          </div>
          <Link
            to="/auth"
            className="rounded-sm border border-primary-foreground/30 px-3 py-1.5 text-[13px] transition-colors hover:bg-primary-foreground/10"
          >
            Acesso institucional
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-24 text-center">
        <p className="rule-label">Módulo complementar — não substitui Sisbemjud ou SNGB</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          A custódia só muda de titular quando as duas instituições assinam.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          Registro de transferência de custódia entre instituições, com lacre físico rastreável e
          histórico auditável na blockchain.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/auth"
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Entrar como instituição
          </Link>
        </div>
      </section>
    </div>
  );
}
