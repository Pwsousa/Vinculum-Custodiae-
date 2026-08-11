import { useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { SectionTitle, Hash, elapsed, formatDate } from "@/lib/custody-ui";
import {
  consultarInstituicao,
  consultarTransferenciasDaInstituicao,
  type TransferenciaApi,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type RemessaPendente = TransferenciaApi & { origemSigla: string };

export function RemessasPendentes() {
  const [institutionId, setInstitutionId] = useState("");
  const [sigla, setSigla] = useState("");
  const [pendentes, setPendentes] = useState<RemessaPendente[]>([]);
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
      const incoming = transferencias.filter(
        (t) => String(t.institutionDestinoId) === id && t.estado === 0,
      );
      const origemIds = [...new Set(incoming.map((t) => String(t.institutionOrigemId)))];
      const pares = await Promise.all(
        origemIds.map(async (origemId) => {
          try {
            const inst = await consultarInstituicao(origemId);
            return [origemId, inst.sigla] as const;
          } catch {
            return [origemId, `Instituição ${origemId}`] as const;
          }
        }),
      );
      const nomes = Object.fromEntries(pares);
      setSigla(instituicao.sigla);
      setPendentes(
        incoming
          .map((t) => ({
            ...t,
            origemSigla: nomes[String(t.institutionOrigemId)] ?? `Instituição ${t.institutionOrigemId}`,
          }))
          .sort((a, b) => a.timestampInicio - b.timestampInicio),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar as remessas.");
      setPendentes([]);
      setSigla("");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="rule-label">Recebimento de custódia</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {sigla ? `${sigla} — remessas pendentes` : "Remessas pendentes de recebimento"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Remessas já iniciadas pela origem que ainda precisam da sua contra-assinatura. Até
            confirmar, a custódia permanece com o remetente.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/painel">Abrir painel completo</Link>
        </Button>
      </div>

      <section className="mb-8 rounded-md border border-border bg-card p-5">
        <form onSubmit={carregar} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="inst">ID da instituição destinária (a sua)</Label>
            <Input
              id="inst"
              placeholder="2"
              className="w-32"
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={carregando}>
            {carregando ? "Carregando…" : "Listar remessas"}
          </Button>
          {erro ? <p className="w-full text-sm text-destructive">{erro}</p> : null}
        </form>
      </section>

      {consultou && !erro ? (
        <section>
          <SectionTitle
            title="Aguardando assinatura de recebimento"
            hint={`${pendentes.length} remessa(s) com estado Iniciada.`}
          />
          {pendentes.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              Nenhuma remessa pendente para esta instituição.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transferência</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Lacre</TableHead>
                  <TableHead>Enviada em</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentes.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">#{t.id}</TableCell>
                    <TableCell>
                      <Hash value={t.itemId} />
                    </TableCell>
                    <TableCell>{t.origemSigla}</TableCell>
                    <TableCell>
                      <Hash value={t.hashLacre} chars={10} />
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDate(t.timestampInicio)}
                      <span className="block text-warning-foreground">{elapsed(t.timestampInicio)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm">
                        <Link to={`/transferencias/${t.id}`}>Confirmar recebimento</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      ) : null}
    </AppShell>
  );
}
