import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { SectionTitle, StatusBadge, Hash, elapsed, formatDate } from "@/lib/custody-ui";
import {
  consultarInstituicao,
  consultarItensDaInstituicao,
  consultarTransferenciasDaInstituicao,
  type TransferenciaApi,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ESTADO_NOME = ["Iniciada", "Confirmada", "ConfirmadaComRessalva", "Recusada"] as const;

type Dados = {
  sigla: string;
  itens: string[];
  incoming: TransferenciaApi[];
  outgoing: TransferenciaApi[];
  recentes: TransferenciaApi[];
};

export function Painel() {
  const navigate = useNavigate();
  const [institutionId, setInstitutionId] = useState("");
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const [idTransferencia, setIdTransferencia] = useState("");
  const [itemIdBusca, setItemIdBusca] = useState("");

  async function verPainel(e: React.FormEvent) {
    e.preventDefault();
    if (!institutionId.trim()) return;
    setCarregando(true);
    setErro("");
    try {
      const [instituicao, { itens }, { transferencias }] = await Promise.all([
        consultarInstituicao(institutionId.trim()),
        consultarItensDaInstituicao(institutionId.trim()),
        consultarTransferenciasDaInstituicao(institutionId.trim()),
      ]);
      const id = institutionId.trim();
      const incoming = transferencias.filter((t) => t.institutionDestinoId === id && t.estado === 0);
      const outgoing = transferencias.filter((t) => t.institutionOrigemId === id && t.estado === 0);
      const recentes = transferencias
        .filter((t) => t.estado !== 0)
        .sort((a, b) => b.timestampConfirmacao - a.timestampConfirmacao)
        .slice(0, 8);
      setDados({ sigla: instituicao.sigla, itens, incoming, outgoing, recentes });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o painel.");
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
          <p className="rule-label">Painel de custódia</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {dados ? dados.sigla : "Ver painel da instituição"}
          </h1>
        </div>
        <Button asChild size="sm">
          <Link to="/transferencias/nova">Nova transferência</Link>
        </Button>
      </div>

      <section className="mb-8 rounded-md border border-border bg-card p-5">
        <form onSubmit={verPainel} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="inst">ID da sua instituição</Label>
            <Input
              id="inst"
              placeholder="1"
              className="w-32"
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={carregando}>
            {carregando ? "Carregando…" : "Ver painel"}
          </Button>
          {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
        </form>
      </section>

      {dados ? (
        <>
          <div className="mb-8 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
            {[
              { label: "Bens sob custódia", value: dados.itens.length },
              { label: "Aguardando minha assinatura", value: dados.incoming.length },
              { label: "Enviados sem aceite", value: dados.outgoing.length },
              {
                label: "Confirmadas com ressalva",
                value: dados.recentes.filter((t) => t.estado === 2).length,
              },
            ].map((k) => (
              <div key={k.label} className="bg-card px-4 py-4">
                <p className="rule-label">{k.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{k.value}</p>
              </div>
            ))}
          </div>

          <section className="mb-8">
            <SectionTitle
              title="Aguardando minha contra-assinatura"
              hint="Enquanto não houver contra-assinatura, a responsabilidade permanece com o remetente."
            />
            {dados.incoming.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Nenhuma remessa pendente.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Lacre</TableHead>
                    <TableHead>1ª assinatura</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.incoming.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Hash value={t.itemId} />
                      </TableCell>
                      <TableCell>Instituição {t.institutionOrigemId}</TableCell>
                      <TableCell>
                        <Hash value={t.hashLacre} chars={10} />
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDate(t.timestampInicio)}
                        <span className="block text-warning-foreground">{elapsed(t.timestampInicio)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/transferencias/${t.id}`}>Conferir e assinar</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          <section className="mb-8">
            <SectionTitle
              title="Enviados e ainda não aceitos"
              hint="Responsabilidade explícita da sua instituição até a segunda assinatura."
            />
            {dados.outgoing.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Nenhuma remessa em aberto.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Lacre</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.outgoing.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Hash value={t.itemId} />
                      </TableCell>
                      <TableCell>Instituição {t.institutionDestinoId}</TableCell>
                      <TableCell>
                        <Hash value={t.hashLacre} chars={10} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={ESTADO_NOME[t.estado]} />
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {elapsed(t.timestampInicio)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/transferencias/${t.id}`}>Detalhes</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          <section className="mb-8">
            <SectionTitle title="Bens sob custódia desta instituição" />
            {dados.itens.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Nenhum bem sob custódia.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.itens.map((itemId) => (
                    <TableRow key={itemId}>
                      <TableCell>
                        <Hash value={itemId} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/bens/${itemId}`}>Cadeia de custódia</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          <section>
            <SectionTitle
              title="Últimos eventos concluídos"
              hint="Divergências permanecem registradas e visíveis, nunca suprimidas."
            />
            <div className="divide-y divide-border rounded-md border border-border bg-card">
              {dados.recentes.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">Sem histórico.</p>
              ) : (
                dados.recentes.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">
                        Instituição {t.institutionOrigemId} → Instituição {t.institutionDestinoId}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(t.timestampConfirmacao)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={ESTADO_NOME[t.estado]} />
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/transferencias/${t.id}`}>Abrir</Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      ) : null}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-md border border-border bg-card p-5">
          <SectionTitle title="Abrir transferência por ID" />
          <form onSubmit={abrirTransferencia} className="flex gap-2">
            <Input
              placeholder="1"
              value={idTransferencia}
              onChange={(e) => setIdTransferencia(e.target.value)}
            />
            <Button type="submit" variant="outline">
              Abrir
            </Button>
          </form>
        </section>

        <section className="rounded-md border border-border bg-card p-5">
          <SectionTitle title="Consultar cadeia de custódia de um item" />
          <form onSubmit={abrirHistoricoItem} className="flex gap-2">
            <Input placeholder="0x…" value={itemIdBusca} onChange={(e) => setItemIdBusca(e.target.value)} />
            <Button type="submit" variant="outline">
              Consultar
            </Button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
