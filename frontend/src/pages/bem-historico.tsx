import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { SectionTitle, StatusBadge, Hash, formatDate } from "@/lib/custody-ui";
import {
  consultarCustodiante,
  consultarHistoricoItem,
  consultarInstituicao,
  type TransferenciaApi,
} from "@/lib/api";
import { Button } from "@/components/ui/button";

const ESTADO_NOME = ["Iniciada", "Confirmada", "ConfirmadaComRessalva", "Recusada"] as const;

export function BemHistorico() {
  const { itemId } = useParams<{ itemId: string }>();
  const [transferencias, setTransferencias] = useState<TransferenciaApi[]>([]);
  const [siglas, setSiglas] = useState<Record<string, string>>({});
  const [custodiante, setCustodiante] = useState<string>("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!itemId) return;
    Promise.all([consultarHistoricoItem(itemId), consultarCustodiante(itemId)])
      .then(async ([hist, cust]) => {
        setTransferencias(hist.transferencias);
        setCustodiante(cust.institutionId);
        const ids = new Set<string>();
        hist.transferencias.forEach((t) => {
          ids.add(t.institutionOrigemId);
          ids.add(t.institutionDestinoId);
        });
        if (cust.institutionId !== "0") ids.add(cust.institutionId);
        const pares = await Promise.all(
          [...ids].map(async (id) => {
            try {
              const inst = await consultarInstituicao(id);
              return [id, inst.sigla] as const;
            } catch {
              return [id, `Instituição ${id}`] as const;
            }
          }),
        );
        setSiglas(Object.fromEntries(pares));
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar."))
      .finally(() => setCarregando(false));
  }, [itemId]);

  function nome(id: string) {
    return siglas[id] ?? `Instituição ${id}`;
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="rule-label">Cadeia de custódia do item</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            <Hash value={itemId ?? ""} chars={20} />
          </h1>
          {custodiante && custodiante !== "0" ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Custodiante atual:{" "}
              <span className="font-medium text-foreground">{nome(custodiante)}</span>
            </p>
          ) : null}
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to={`/reconciliacao?itemId=${encodeURIComponent(itemId ?? "")}`}>
            Reconciliar sistemas
          </Link>
        </Button>
      </div>

      <section>
        <SectionTitle
          title="Histórico de transferências"
          hint="Ordem cronológica. Qualquer instituição autorizada (ex.: Justiça Federal) pode ler a cadeia pretérita sem solicitar ao tribunal estadual."
        />
        {carregando ? (
          <p className="py-3 text-sm text-muted-foreground">Carregando…</p>
        ) : erro ? (
          <p className="py-3 text-sm text-destructive">{erro}</p>
        ) : transferencias.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">
            Nenhuma transferência registrada pra este item.
          </p>
        ) : (
          <ol className="relative space-y-0 border-l border-border pl-6">
            {transferencias.map((t, i) => {
              const estadoNome = ESTADO_NOME[t.estado] ?? String(t.estado);
              return (
                <li key={t.id} className="relative pb-6 last:pb-0">
                  <span className="absolute -left-[1.55rem] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-card text-[9px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="rounded-md border border-border bg-card p-4 transition-shadow hover:shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium">
                        {nome(t.institutionOrigemId)} → {nome(t.institutionDestinoId)}
                      </p>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={estadoNome} />
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/transferencias/${t.id}`}>Abrir</Link>
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                      <span>
                        Lacre: <Hash value={t.hashLacre} chars={10} />
                      </span>
                      <span>1ª assinatura: {formatDate(t.timestampInicio)}</span>
                      {t.timestampConfirmacao ? (
                        <span>2ª assinatura: {formatDate(t.timestampConfirmacao)}</span>
                      ) : null}
                    </div>
                    {t.ressalva ? (
                      <p className="mt-2 text-[13px] text-destructive">{t.ressalva}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </AppShell>
  );
}
