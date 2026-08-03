import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { SectionTitle, StatusBadge, Hash, formatDate } from "@/lib/custody-ui";
import { consultarHistoricoItem, type TransferenciaApi } from "@/lib/api";
import { Button } from "@/components/ui/button";

const ESTADO_NOME = ["Iniciada", "Confirmada", "ConfirmadaComRessalva", "Recusada"] as const;

export function BemHistorico() {
  const { itemId } = useParams<{ itemId: string }>();
  const [transferencias, setTransferencias] = useState<TransferenciaApi[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!itemId) return;
    consultarHistoricoItem(itemId)
      .then((r) => setTransferencias(r.transferencias))
      .catch((e) => setErro(e instanceof Error ? e.message : "Falha ao carregar."))
      .finally(() => setCarregando(false));
  }, [itemId]);

  return (
    <AppShell>
      <div className="mb-6">
        <p className="rule-label">Cadeia de custódia do item</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          <Hash value={itemId ?? ""} chars={20} />
        </h1>
      </div>

      <section>
        <SectionTitle
          title="Histórico de transferências"
          hint="Ordem cronológica, do primeiro registro ao mais recente. Divergências permanecem visíveis."
        />
        {carregando ? (
          <p className="py-3 text-sm text-muted-foreground">Carregando…</p>
        ) : erro ? (
          <p className="py-3 text-sm text-destructive">{erro}</p>
        ) : transferencias.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">Nenhuma transferência registrada pra este item.</p>
        ) : (
          <ol className="space-y-3">
            {transferencias.map((t, i) => {
              const estadoNome = ESTADO_NOME[t.estado] ?? String(t.estado);
              return (
                <li key={i} className="rounded-md border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium">
                      {i + 1}. Instituição {t.institutionOrigemId} → Instituição{" "}
                      {t.institutionDestinoId}
                    </p>
                    <StatusBadge status={estadoNome} />
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                    <span>
                      Lacre: <Hash value={t.hashLacre} chars={10} />
                    </span>
                    <span>1ª assinatura: {formatDate(t.timestampInicio)}</span>
                    {t.timestampConfirmacao ? <span>2ª assinatura: {formatDate(t.timestampConfirmacao)}</span> : null}
                  </div>
                  {t.ressalva ? <p className="mt-2 text-[13px] text-destructive">{t.ressalva}</p> : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </AppShell>
  );
}
