import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { SectionTitle, StatusBadge, Hash, elapsed, formatDate } from "@/lib/custody-ui";
import {
  consultarCustodiante,
  consultarInstituicao,
  consultarItensDaInstituicao,
  consultarTransferenciasDaInstituicao,
  type TransferenciaApi,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const ESTADO_NOME = ["Iniciada", "Confirmada", "ConfirmadaComRessalva", "Recusada"] as const;
const STORAGE_KEY = "vc.painel.institutionId";

type TransferenciaEnriquecida = TransferenciaApi & {
  origemSigla: string;
  destinoSigla: string;
};

type Dados = {
  institutionId: string;
  sigla: string;
  threshold: number;
  ativa: boolean;
  itens: string[];
  incoming: TransferenciaEnriquecida[];
  outgoing: TransferenciaEnriquecida[];
  recentes: TransferenciaEnriquecida[];
  totalTransferencias: number;
  confirmadas: number;
  comRessalva: number;
  recusadas: number;
  /** itemId lowercased → institutionId custodiante atual */
  custodiaPorItem: Record<string, string>;
  nomesInstituicao: Record<string, string>;
};

async function resolverSiglas(ids: string[]): Promise<Record<string, string>> {
  const pares = await Promise.all(
    ids.map(async (id) => {
      try {
        const inst = await consultarInstituicao(id);
        return [id, inst.sigla] as const;
      } catch {
        return [id, `Instituição ${id}`] as const;
      }
    }),
  );
  return Object.fromEntries(pares);
}

function enriquecer(
  transferencias: TransferenciaApi[],
  nomes: Record<string, string>,
): TransferenciaEnriquecida[] {
  return transferencias.map((t) => ({
    ...t,
    origemSigla: nomes[String(t.institutionOrigemId)] ?? `Instituição ${t.institutionOrigemId}`,
    destinoSigla: nomes[String(t.institutionDestinoId)] ?? `Instituição ${t.institutionDestinoId}`,
  }));
}

export function Painel() {
  const navigate = useNavigate();
  const [institutionId, setInstitutionId] = useState(
    () => sessionStorage.getItem(STORAGE_KEY) ?? "",
  );
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [idTransferencia, setIdTransferencia] = useState("");
  const [itemIdBusca, setItemIdBusca] = useState("");

  const urgencia = useMemo(() => {
    if (!dados) return null;
    if (dados.incoming.length > 0) {
      return {
        tom: "warning" as const,
        titulo: `${dados.incoming.length} remessa(s) aguardando seu recebimento`,
        texto: "A custódia ainda está com o remetente até a contra-assinatura.",
        to: "/remessas",
        cta: "Ver remessas pendentes",
      };
    }
    if (dados.outgoing.length > 0) {
      return {
        tom: "muted" as const,
        titulo: `${dados.outgoing.length} remessa(s) enviada(s) sem aceite`,
        texto: "Sua instituição permanece responsável até o destino confirmar.",
        to: "/historico",
        cta: "Ver histórico",
      };
    }
    return null;
  }, [dados]);

  async function verPainel(e?: React.FormEvent) {
    e?.preventDefault();
    const id = institutionId.trim();
    if (!id) return;
    setCarregando(true);
    setErro("");
    try {
      const [instituicao, { itens }, { transferencias }] = await Promise.all([
        consultarInstituicao(id),
        consultarItensDaInstituicao(id),
        consultarTransferenciasDaInstituicao(id),
      ]);

      const idsInst = new Set<string>([id]);
      for (const t of transferencias) {
        idsInst.add(String(t.institutionOrigemId));
        idsInst.add(String(t.institutionDestinoId));
      }
      const nomes = await resolverSiglas([...idsInst]);
      const todas = enriquecer(transferencias, nomes);

      const incoming = todas
        .filter((t) => String(t.institutionDestinoId) === id && t.estado === 0)
        .sort((a, b) => a.timestampInicio - b.timestampInicio);
      const outgoing = todas
        .filter((t) => String(t.institutionOrigemId) === id && t.estado === 0)
        .sort((a, b) => a.timestampInicio - b.timestampInicio);
      const recentes = todas
        .filter((t) => t.estado !== 0)
        .sort((a, b) => (b.timestampConfirmacao || b.timestampInicio) - (a.timestampConfirmacao || a.timestampInicio))
        .slice(0, 10);

      const itensRecentes = [...new Set(recentes.map((t) => t.itemId))];
      const custodiaPares = await Promise.all(
        itensRecentes.map(async (itemId) => {
          try {
            const { institutionId: custId } = await consultarCustodiante(itemId);
            return [itemId.toLowerCase(), custId] as const;
          } catch {
            return [itemId.toLowerCase(), ""] as const;
          }
        }),
      );
      const custodiaPorItem = Object.fromEntries(custodiaPares.filter(([, custId]) => custId && custId !== "0"));

      const idsCustodia = [...new Set(Object.values(custodiaPorItem))];
      const nomesExtra = await resolverSiglas(idsCustodia.filter((custId) => !nomes[custId]));
      const nomesInstituicao = { ...nomes, ...nomesExtra };

      sessionStorage.setItem(STORAGE_KEY, id);
      setDados({
        institutionId: id,
        sigla: instituicao.sigla,
        threshold: instituicao.threshold,
        ativa: instituicao.ativa,
        itens,
        incoming,
        outgoing,
        recentes,
        totalTransferencias: transferencias.length,
        confirmadas: transferencias.filter((t) => t.estado === 1).length,
        comRessalva: transferencias.filter((t) => t.estado === 2).length,
        recusadas: transferencias.filter((t) => t.estado === 3).length,
        custodiaPorItem,
        nomesInstituicao,
      });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível carregar o painel.");
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }

  function abrirTransferencia(e: React.FormEvent) {
    e.preventDefault();
    if (idTransferencia.trim()) navigate(`/transferencias/${idTransferencia.trim()}`);
  }

  function abrirHistoricoItem(e: React.FormEvent) {
    e.preventDefault();
    if (itemIdBusca.trim()) navigate(`/bens/${itemIdBusca.trim()}`);
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="rule-label">Painel operacional</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {dados ? dados.sigla : "Custódia da instituição"}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Visão única de bens sob sua responsabilidade, remessas a receber e a acompanhar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/remessas">Remessas</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/historico">Histórico</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/transferencias/nova">Nova transferência</Link>
          </Button>
        </div>
      </div>

      <section className="mb-6 rounded-md border border-border bg-card p-5">
        <form onSubmit={verPainel} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="inst">ID da instituição</Label>
            <Input
              id="inst"
              placeholder="1"
              className="w-36"
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={carregando}>
            {carregando ? "Atualizando…" : dados ? "Atualizar painel" : "Abrir painel"}
          </Button>
          {dados ? (
            <p className="text-xs text-muted-foreground">
              Instituição #{dados.institutionId} · threshold {dados.threshold} ·{" "}
              {dados.ativa ? (
                <span className="text-success">ativa</span>
              ) : (
                <span className="text-destructive">inativa</span>
              )}
            </p>
          ) : null}
          {erro ? <p className="w-full text-sm text-destructive">{erro}</p> : null}
        </form>
      </section>

      {!dados && !carregando ? (
        <div className="rounded-md border border-dashed border-border bg-muted/40 px-5 py-10 text-center">
          <p className="text-sm font-medium">Informe o ID da sua instituição para começar</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Ex.: Polícia = 1, Perícia = 2 (conforme o cadastro em Instituições).
          </p>
        </div>
      ) : null}

      {dados ? (
        <>
          {urgencia ? (
            <div
              className={cn(
                "mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3",
                urgencia.tom === "warning"
                  ? "border-warning/40 bg-warning/10"
                  : "border-border bg-muted/50",
              )}
            >
              <div>
                <p className="text-sm font-medium">{urgencia.titulo}</p>
                <p className="text-xs text-muted-foreground">{urgencia.texto}</p>
              </div>
              <Button asChild size="sm" variant={urgencia.tom === "warning" ? "default" : "outline"}>
                <Link to={urgencia.to}>{urgencia.cta}</Link>
              </Button>
            </div>
          ) : (
            <div className="mb-6 rounded-md border border-success/30 bg-success/10 px-4 py-3">
              <p className="text-sm font-medium text-success">Nenhuma remessa pendente</p>
              <p className="text-xs text-muted-foreground">
                Não há recebimentos à assinar nem envios aguardando o destino.
              </p>
            </div>
          )}

          <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Bens sob custódia"
              value={dados.itens.length}
              hint="Itens com custodiante atual = você"
              destaque={dados.itens.length > 0}
            />
            <Kpi
              label="A receber"
              value={dados.incoming.length}
              hint="Contra-assinatura pendente"
              destaque={dados.incoming.length > 0}
              tom={dados.incoming.length > 0 ? "warning" : undefined}
            />
            <Kpi
              label="Enviados em aberto"
              value={dados.outgoing.length}
              hint="Aguardando aceite do destino"
              destaque={dados.outgoing.length > 0}
            />
            <Kpi
              label="Movimentações"
              value={dados.totalTransferencias}
              hint={`${dados.confirmadas} ok · ${dados.comRessalva} ressalva · ${dados.recusadas} recusada`}
            />
          </div>

          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-md border border-border bg-card p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <SectionTitle
                  title="Receber agora"
                  hint="Remessas iniciadas para você — confirme ou recuse."
                />
                <Button asChild size="sm" variant="ghost">
                  <Link to="/remessas">Ver todas</Link>
                </Button>
              </div>
              {dados.incoming.length === 0 ? (
                <Empty texto="Nenhuma remessa aguardando recebimento." />
              ) : (
                <ul className="space-y-3">
                  {dados.incoming.slice(0, 5).map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-warning/30 bg-warning/5 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          #{t.id} · {t.origemSigla} → {dados.sigla}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          Item <Hash value={t.itemId} chars={8} /> · {formatDate(t.timestampInicio)} ·{" "}
                          <span className="text-warning-foreground">{elapsed(t.timestampInicio)}</span>
                        </p>
                      </div>
                      <Button asChild size="sm">
                        <Link to={`/transferencias/${t.id}`}>Assinar recebimento</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-md border border-border bg-card p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <SectionTitle
                  title="Enviados sem aceite"
                  hint="Custódia ainda é sua até a 2ª assinatura."
                />
                <Button asChild size="sm" variant="ghost">
                  <Link to="/historico">Histórico</Link>
                </Button>
              </div>
              {dados.outgoing.length === 0 ? (
                <Empty texto="Nenhuma remessa sua em aberto." />
              ) : (
                <ul className="space-y-3">
                  {dados.outgoing.slice(0, 5).map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-muted/30 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          #{t.id} · {dados.sigla} → {t.destinoSigla}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          Item <Hash value={t.itemId} chars={8} /> · {elapsed(t.timestampInicio)}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/transferencias/${t.id}`}>Detalhes</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="mb-8 rounded-md border border-border bg-card p-5">
            <SectionTitle
              title="Inventário sob custódia"
              hint={`${dados.itens.length} bem(ns) cuja custódia atual é ${dados.sigla}. Itens já aceitos pelo destino saem desta lista — não é o mesmo conjunto do histórico abaixo.`}
            />
            {dados.itens.length === 0 ? (
              <Empty texto="Nenhum bem sob custódia desta instituição." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Item (hash único)</TableHead>
                    <TableHead>Custodiante</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.itens.map((itemId, i) => {
                    const remessaAberta = dados.outgoing.find((t) => t.itemId.toLowerCase() === itemId.toLowerCase());
                    return (
                      <TableRow key={itemId}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <Hash value={itemId} />
                        </TableCell>
                        <TableCell className="text-sm">{dados.sigla}</TableCell>
                        <TableCell className="text-xs">
                          {remessaAberta ? (
                            <span className="text-warning-foreground">
                              Remessa #{remessaAberta.id} → {remessaAberta.destinoSigla}
                              <span className="mt-0.5 block text-muted-foreground">
                                Aguardando aceite do destino
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Disponível para transferência</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button asChild size="sm" variant="ghost">
                              <Link to={`/bens/${itemId}`}>Cadeia</Link>
                            </Button>
                            {remessaAberta ? (
                              <Button asChild size="sm" variant="outline">
                                <Link to={`/transferencias/${remessaAberta.id}`}>Ver remessa</Link>
                              </Button>
                            ) : (
                              <Button asChild size="sm" variant="outline">
                                <Link to={`/transferencias/nova?itemId=${encodeURIComponent(itemId)}`}>
                                  Transferir
                                </Link>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </section>

          <section className="mb-8 rounded-md border border-border bg-card p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <SectionTitle
                title="Últimas transferências concluídas"
                hint="Esses bens já saíram (ou voltaram) conforme o aceite. Não confundir com o inventário acima — lá só entram itens cuja custódia atual ainda é sua."
              />
              <Button asChild size="sm" variant="ghost">
                <Link to="/historico">Histórico completo</Link>
              </Button>
            </div>
            {dados.recentes.length === 0 ? (
              <Empty texto="Ainda não há transferências concluídas envolvendo esta instituição." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Fluxo</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Custódia agora</TableHead>
                    <TableHead>Conclusão</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.recentes.map((t) => {
                    const custodiaAtual = dados.custodiaPorItem[t.itemId.toLowerCase()];
                    const aindaComigo = custodiaAtual === dados.institutionId;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.id}</TableCell>
                        <TableCell className="text-sm">
                          {t.origemSigla} → {t.destinoSigla}
                        </TableCell>
                        <TableCell>
                          <Hash value={t.itemId} chars={8} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={ESTADO_NOME[t.estado] ?? String(t.estado)} />
                          {t.ressalva ? (
                            <p className="mt-1 max-w-48 truncate text-xs text-destructive" title={t.ressalva}>
                              {t.ressalva}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">
                          {custodiaAtual ? (
                            <span className={aindaComigo ? "text-foreground" : "text-muted-foreground"}>
                              {dados.nomesInstituicao[custodiaAtual] ?? `Instituição ${custodiaAtual}`}
                              {!aindaComigo ? (
                                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                  Saiu do seu inventário
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(t.timestampConfirmacao || t.timestampInicio)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="ghost">
                            <Link to={`/transferencias/${t.id}`}>Abrir</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-md border border-border bg-card p-5">
              <SectionTitle title="Abrir transferência por ID" hint="Útil se você já sabe o número da remessa." />
              <form onSubmit={abrirTransferencia} className="flex gap-2">
                <Input
                  placeholder="ex.: 1"
                  value={idTransferencia}
                  onChange={(e) => setIdTransferencia(e.target.value)}
                />
                <Button type="submit" variant="outline">
                  Abrir
                </Button>
              </form>
            </section>

            <section className="rounded-md border border-border bg-card p-5">
              <SectionTitle
                title="Consultar cadeia de um item"
                hint="Cole o itemId (0x…) gerado no registro do bem."
              />
              <form onSubmit={abrirHistoricoItem} className="flex gap-2">
                <Input
                  placeholder="0x…"
                  value={itemIdBusca}
                  onChange={(e) => setItemIdBusca(e.target.value)}
                />
                <Button type="submit" variant="outline">
                  Consultar
                </Button>
              </form>
            </section>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  hint,
  destaque,
  tom,
}: {
  label: string;
  value: number;
  hint: string;
  destaque?: boolean;
  tom?: "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card px-4 py-4",
        destaque && tom === "warning" && "border-warning/40 bg-warning/10",
        destaque && !tom && "border-primary/25",
      )}
    >
      <p className="rule-label">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}

function Empty({ texto }: { texto: string }) {
  return <p className="py-4 text-sm text-muted-foreground">{texto}</p>;
}
