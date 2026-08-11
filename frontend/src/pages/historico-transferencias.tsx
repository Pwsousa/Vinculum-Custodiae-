import { useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { SectionTitle, StatusBadge, Hash, formatDate } from "@/lib/custody-ui";
import {
  consultarInstituicao,
  consultarTransferenciasDaInstituicao,
  type TransferenciaApi,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ESTADO_NOME = ["Iniciada", "Confirmada", "ConfirmadaComRessalva", "Recusada"] as const;

type FiltroEstado = "todas" | "concluidas" | "pendentes" | "recusadas";

type TransferenciaHistorico = TransferenciaApi & {
  origemSigla: string;
  destinoSigla: string;
  papel: "origem" | "destino" | "ambos";
};

export function HistoricoTransferencias() {
  const [institutionId, setInstitutionId] = useState("");
  const [sigla, setSigla] = useState("");
  const [filtro, setFiltro] = useState<FiltroEstado>("todas");
  const [lista, setLista] = useState<TransferenciaHistorico[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [consultou, setConsultou] = useState(false);

  async function carregar(e: React.FormEvent) {
    e.preventDefault();
    const id = institutionId.trim();
    if (!id) return;
    setCarregando(true);
    setErro("");
    setConsultou(true);
    try {
      const [instituicao, { transferencias }] = await Promise.all([
        consultarInstituicao(id),
        consultarTransferenciasDaInstituicao(id),
      ]);

      const idsInst = new Set<string>();
      for (const t of transferencias) {
        idsInst.add(String(t.institutionOrigemId));
        idsInst.add(String(t.institutionDestinoId));
      }
      const pares = await Promise.all(
        [...idsInst].map(async (instId) => {
          try {
            const inst = await consultarInstituicao(instId);
            return [instId, inst.sigla] as const;
          } catch {
            return [instId, `Instituição ${instId}`] as const;
          }
        }),
      );
      const nomes = Object.fromEntries(pares);

      const enriquecidas: TransferenciaHistorico[] = transferencias.map((t) => {
        const origem = String(t.institutionOrigemId);
        const destino = String(t.institutionDestinoId);
        let papel: TransferenciaHistorico["papel"] = "origem";
        if (origem === id && destino === id) papel = "ambos";
        else if (destino === id) papel = "destino";
        return {
          ...t,
          origemSigla: nomes[origem] ?? `Instituição ${origem}`,
          destinoSigla: nomes[destino] ?? `Instituição ${destino}`,
          papel,
        };
      });

      enriquecidas.sort((a, b) => {
        const ta = a.timestampConfirmacao || a.timestampInicio;
        const tb = b.timestampConfirmacao || b.timestampInicio;
        return tb - ta;
      });

      setSigla(instituicao.sigla);
      setLista(enriquecidas);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o histórico.");
      setLista([]);
      setSigla("");
    } finally {
      setCarregando(false);
    }
  }

  const filtradas = lista.filter((t) => {
    if (filtro === "pendentes") return t.estado === 0;
    if (filtro === "concluidas") return t.estado === 1 || t.estado === 2;
    if (filtro === "recusadas") return t.estado === 3;
    return true;
  });

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="rule-label">Cadeia de remessas</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {sigla ? `${sigla} — histórico de transferências` : "Histórico de transferências"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Todas as remessas em que a instituição participou como origem ou destino, da mais
            recente para a mais antiga.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/remessas">Remessas pendentes</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/painel">Painel</Link>
          </Button>
        </div>
      </div>

      <section className="mb-6 rounded-md border border-border bg-card p-5">
        <form onSubmit={carregar} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="inst">ID da instituição</Label>
            <Input
              id="inst"
              placeholder="1"
              className="w-32"
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={carregando}>
            {carregando ? "Carregando…" : "Carregar histórico"}
          </Button>
          {erro ? <p className="w-full text-sm text-destructive">{erro}</p> : null}
        </form>
      </section>

      {consultou && !erro ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                ["todas", "Todas"],
                ["pendentes", "Pendentes"],
                ["concluidas", "Concluídas"],
                ["recusadas", "Recusadas"],
              ] as const
            ).map(([valor, rotulo]) => (
              <Button
                key={valor}
                type="button"
                size="sm"
                variant={filtro === valor ? "default" : "outline"}
                onClick={() => setFiltro(valor)}
              >
                {rotulo}
              </Button>
            ))}
          </div>

          <section>
            <SectionTitle
              title="Transferências"
              hint={`${filtradas.length} de ${lista.length} registro(s).`}
            />
            {filtradas.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                Nenhuma transferência neste filtro.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Fluxo</TableHead>
                    <TableHead>Seu papel</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Datas</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.id}</TableCell>
                      <TableCell>
                        <Link to={`/bens/${t.itemId}`} className="hover:underline">
                          <Hash value={t.itemId} />
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.origemSigla} → {t.destinoSigla}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.papel === "origem"
                          ? "Remetente"
                          : t.papel === "destino"
                            ? "Destinatário"
                            : "Ambos"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={ESTADO_NOME[t.estado] ?? String(t.estado)} />
                        {t.ressalva ? (
                          <p className="mt-1 max-w-[14rem] truncate text-xs text-destructive" title={t.ressalva}>
                            {t.ressalva}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <span className="block">Início: {formatDate(t.timestampInicio)}</span>
                        {t.timestampConfirmacao ? (
                          <span className="block">Fim: {formatDate(t.timestampConfirmacao)}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/transferencias/${t.id}`}>Abrir</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
