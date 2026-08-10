import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { SectionTitle, Hash } from "@/lib/custody-ui";
import {
  listarSistemasInstitucionais,
  reconciliarItem,
  type ResultadoReconciliacaoApi,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Reconciliacao() {
  const [searchParams] = useSearchParams();
  const [sistemas, setSistemas] = useState<Awaited<ReturnType<typeof listarSistemasInstitucionais>> | null>(
    null,
  );
  const [itemId, setItemId] = useState(searchParams.get("itemId") ?? "");
  const [resultado, setResultado] = useState<ResultadoReconciliacaoApi | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    listarSistemasInstitucionais()
      .then(setSistemas)
      .catch(() =>
        setErro(
          "Mocks institucionais indisponíveis. Inicie mocks/sisbemjud (4001) e mocks/policia-civil (4002).",
        ),
      );
  }, []);

  useEffect(() => {
    const seed = searchParams.get("itemId");
    if (!seed?.trim()) return;
    setItemId(seed);
    setCarregando(true);
    reconciliarItem(seed.trim())
      .then(setResultado)
      .catch((err) => setErro(err instanceof Error ? err.message : "Falha na reconciliação."))
      .finally(() => setCarregando(false));
  }, [searchParams]);

  async function reconciliar(e: React.FormEvent) {
    e.preventDefault();
    if (!itemId.trim()) return;
    setCarregando(true);
    setErro("");
    try {
      setResultado(await reconciliarItem(itemId.trim()));
    } catch (err) {
      setResultado(null);
      setErro(err instanceof Error ? err.message : "Falha na reconciliação.");
    } finally {
      setCarregando(false);
    }
  }

  function usarSeed(hash: string) {
    setItemId(hash);
  }

  return (
    <AppShell>
      <div className="mb-6">
        <p className="rule-label">Camada de reconciliação</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          Sistemas institucionais heterogêneos
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Sisbemjud e Polícia Civil usam esquemas deliberadamente distintos. Cada um registra o que
          o bem <em>é</em>; à blockchain vai apenas o evento de transferência. Este painel normaliza
          e confronta as duas visões.
        </p>
      </div>

      {sistemas ? (
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <SistemaCard
            titulo={sistemas.sisbemjud.sistema || "Sisbemjud"}
            esquema={sistemas.sisbemjud.esquema}
            registros={sistemas.sisbemjud.bens}
            chaveItem="itemIdBlockchain"
            onUsar={usarSeed}
          />
          <SistemaCard
            titulo={sistemas.policiaCivil.sistema || "Polícia Civil"}
            esquema={sistemas.policiaCivil.esquema}
            registros={sistemas.policiaCivil.apreensoes}
            chaveItem="hashItemCadeia"
            onUsar={usarSeed}
          />
        </div>
      ) : null}

      <section className="mb-8 rounded-md border border-border bg-card p-5">
        <SectionTitle
          title="Reconciliar por itemId (hash on-chain)"
          hint="Use um hash espelhado nos dois mocks (botão “Reconciliar” nos cards acima)."
        />
        <form onSubmit={reconciliar} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[280px] flex-1 space-y-1.5">
            <Label htmlFor="item">itemId</Label>
            <Input
              id="item"
              placeholder="0x…"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={carregando}>
            {carregando ? "Consultando…" : "Reconciliar"}
          </Button>
        </form>
        {erro ? <p className="mt-3 text-sm text-destructive">{erro}</p> : null}
      </section>

      {resultado ? (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="rounded-md border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{resultado.observacao}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ListaResultado
              titulo="Convergências"
              itens={resultado.convergencias}
              tom="success"
              vazio="Nenhuma convergência detectada."
            />
            <ListaResultado
              titulo="Divergências"
              itens={resultado.divergencias}
              tom="destructive"
              vazio="Nenhuma divergência — esquemas alinhados neste ponto."
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <JsonBloco titulo="Canônico — Sisbemjud" dados={resultado.canonicos.sisbemjud} />
            <JsonBloco titulo="Canônico — Polícia Civil" dados={resultado.canonicos.policiaCivil} />
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}

function SistemaCard({
  titulo,
  esquema,
  registros,
  chaveItem,
  onUsar,
}: {
  titulo: string;
  esquema: string;
  registros: Record<string, unknown>[];
  chaveItem: string;
  onUsar: (hash: string) => void;
}) {
  return (
    <section className="rounded-md border border-border bg-card p-5">
      <p className="rule-label">{titulo}</p>
      <p className="mt-1 text-xs text-muted-foreground">{esquema || "—"}</p>
      <ul className="mt-4 space-y-3">
        {registros.length === 0 ? (
          <li className="text-sm text-muted-foreground">Sem registros (mock offline?)</li>
        ) : (
          registros.map((r, i) => {
            const hash = String(r[chaveItem] ?? "");
            return (
              <li key={i} className="rounded-sm border border-border/80 bg-muted/40 px-3 py-2.5">
                <pre className="max-h-36 overflow-auto font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {JSON.stringify(r, null, 2)}
                </pre>
                {hash ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => onUsar(hash)}
                  >
                    Reconciliar este item
                  </Button>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}

function ListaResultado({
  titulo,
  itens,
  tom,
  vazio,
}: {
  titulo: string;
  itens: string[];
  tom: "success" | "destructive";
  vazio: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-5">
      <SectionTitle title={titulo} />
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {itens.map((item) => (
            <li
              key={item}
              className={tom === "success" ? "text-success" : "text-destructive"}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function JsonBloco({ titulo, dados }: { titulo: string; dados: Record<string, unknown> | null }) {
  return (
    <div className="rounded-md border border-border bg-card p-5">
      <SectionTitle title={titulo} />
      {dados ? (
        <pre className="overflow-auto font-mono text-[11px] leading-relaxed text-muted-foreground">
          {JSON.stringify(dados, null, 2)}
        </pre>
      ) : (
        <p className="text-sm text-muted-foreground">Sem registro neste sistema.</p>
      )}
      {dados && typeof dados.identificadorOrigem === "string" ? (
        <p className="mt-2 text-xs">
          Origem: <Hash value={String(dados.identificadorOrigem)} chars={24} />
        </p>
      ) : null}
    </div>
  );
}
