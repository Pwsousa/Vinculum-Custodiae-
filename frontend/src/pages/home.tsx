import { Link } from "react-router-dom";

export function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,oklch(0.36_0.086_258/0.12),transparent_70%)]" />
        <div className="absolute right-0 top-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,oklch(0.55_0.04_250/0.1),transparent_70%)]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(0.9 0.01 252 / 0.45) 1px, transparent 1px), linear-gradient(90deg, oklch(0.9 0.01 252 / 0.45) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "linear-gradient(to bottom, black 0%, transparent 85%)",
          }}
        />
      </div>

      <header className="relative border-b border-border/80 bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-primary-foreground/40 text-[11px] font-semibold tracking-wide">
              VC
            </span>
            <div>
              <p className="text-sm font-semibold leading-none">Vinculum Custodiae</p>
              <p className="mt-1 text-[11px] text-primary-foreground/70">
                Cadeia de Custódia Interinstitucional
              </p>
            </div>
          </div>
          <Link
            to="/auth"
            className="rounded-sm border border-primary-foreground/30 px-3 py-1.5 text-[13px] transition-colors hover:bg-primary-foreground/10"
          >
            Acesso institucional
          </Link>
        </div>
      </header>

      <section className="relative mx-auto max-w-4xl px-5 pb-16 pt-20 text-center sm:pt-28">
        <p className="rule-label animate-in fade-in duration-700">
          Módulo complementar — não substitui Sisbemjud ou SNGB
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-[1.12] tracking-tight text-foreground animate-in fade-in slide-in-from-bottom-3 duration-700 sm:text-5xl">
          Vinculum Custodiae
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-1000">
          A custódia só muda de titular quando origem e destino assinam. Enquanto o receptor não
          contra-assina, a responsabilidade permanece com quem enviou — sem trânsito indefinido.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3 animate-in fade-in duration-1000">
          <Link
            to="/auth"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Entrar como instituição
          </Link>
          <Link
            to="/demo/declinio-federal"
            className="rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            Ver cenário federal
          </Link>
        </div>
      </section>

      <section className="relative mx-auto grid max-w-6xl gap-px overflow-hidden rounded-md border border-border bg-border px-5 sm:grid-cols-3 sm:px-0">
        {[
          {
            title: "Dupla assinatura",
            body: "Início pela origem; custódia só transfere com contra-assinatura do destino.",
          },
          {
            title: "Ressalva de 1ª classe",
            body: "Lacre rompido, peso divergente ou item faltante ficam registrados — nunca omitidos.",
          },
          {
            title: "Lacre + QR",
            body: "Cada transporte vincula um ID de lacre físico único, com QR gerado na remessa.",
          },
        ].map((card, i) => (
          <div
            key={card.title}
            className="bg-card px-5 py-6 text-left animate-in fade-in slide-in-from-bottom-2 duration-700"
            style={{ animationDelay: `${120 + i * 80}ms` }}
          >
            <p className="rule-label">{card.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
          </div>
        ))}
      </section>

      <section className="relative mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-md border border-border bg-card p-6">
            <p className="rule-label">Reconciliação interinstitucional</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">
              Dois sistemas, um registro comum de custódia
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Mocks de Sisbemjud e Polícia Civil com esquemas deliberadamente distintos. A
              blockchain arbitra quem entregou, quem recebeu, quando e sob qual lacre.
            </p>
            <Link
              to="/reconciliacao"
              className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
            >
              Abrir painel de reconciliação →
            </Link>
          </div>
          <div className="rounded-md border border-border bg-card p-6">
            <p className="rule-label">Demonstração exigida</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">
              Declínio Estadual → Federal
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              O juízo federal consulta toda a cadeia pretérita na blockchain, sem pedir nada ao
              tribunal estadual.
            </p>
            <Link
              to="/demo/declinio-federal"
              className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
            >
              Ver roteiro da demo →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
