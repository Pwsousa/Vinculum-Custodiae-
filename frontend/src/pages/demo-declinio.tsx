import { Link } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

/**
 * Página de apoio ao cenário de demonstração exigido:
 * declínio de competência Justiça Estadual → Federal.
 * A consulta da cadeia pretérita não depende do tribunal estadual.
 */
export function DemoDeclinio() {
  return (
    <AppShell>
      <div className="mb-8 max-w-3xl">
        <p className="rule-label">Cenário de demonstração — Projeto 5</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Declínio de competência: Estadual → Federal
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Um bem apreendido migra de esfera. O juízo federal deve conseguir verificar toda a cadeia
          de custódia pretérita sem solicitar nada ao tribunal estadual — a leitura é direta na
          blockchain, para qualquer instituição autorizada (signatária).
        </p>
      </div>

      <ol className="mb-10 space-y-4">
        {[
          {
            n: "1",
            t: "Polícia Civil registra o bem",
            d: "Custódia inicial on-chain. Os sistemas locais (BO, Sisbemjud) continuam com seus próprios esquemas.",
          },
          {
            n: "2",
            t: "Transferências na esfera estadual",
            d: "Polícia → Perícia → Justiça Estadual, cada uma com dupla assinatura e lacre físico único. Ressalvas (ex.: divergência de peso) ficam registradas.",
          },
          {
            n: "3",
            t: "Declínio para a Justiça Federal",
            d: "Justiça Estadual inicia; Justiça Federal contra-assina. Só então a custódia muda de titular.",
          },
          {
            n: "4",
            t: "Consulta federal da cadeia pretérita",
            d: "Signatário da Justiça Federal chama consultarHistoricoItem — vê lacres, timestamps e ressalvas de toda a trilha estadual, sem ofício ao TJ.",
          },
        ].map((passo) => (
          <li
            key={passo.n}
            className="flex gap-4 rounded-md border border-border bg-card p-4 animate-in fade-in slide-in-from-left-2 duration-500"
            style={{ animationDelay: `${Number(passo.n) * 60}ms` }}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-primary text-sm font-semibold text-primary-foreground">
              {passo.n}
            </span>
            <div>
              <p className="text-sm font-semibold">{passo.t}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{passo.d}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/painel">Abrir painel e consultar cadeia</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/reconciliacao">Ver mocks Sisbemjud × Polícia</Link>
        </Button>
      </div>

      <aside className="mt-8 rounded-md border border-dashed border-border bg-muted/50 p-5 text-[13px] leading-relaxed text-muted-foreground">
        <p className="rule-label text-foreground">Script on-chain</p>
        <p className="mt-2 font-mono text-xs text-foreground">
          npx hardhat run scripts/demo-declinio-federal.ts
        </p>
        <p className="mt-2">
          Executa o fluxo completo na rede Hardhat e imprime o histórico lido pela carteira da
          Justiça Federal.
        </p>
      </aside>
    </AppShell>
  );
}
