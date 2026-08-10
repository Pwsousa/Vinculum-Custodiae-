import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { SectionTitle, StatusBadge, Hash, formatDate, DISCREPANCY_LABEL } from "@/lib/custody-ui";
import { useWallet } from "@/lib/wallet";
import {
  assinarComWallet,
  consultarInstituicao,
  consultarTransferencia,
  prepararConfirmar,
  prepararRecusar,
  relayConfirmar,
  relayRecusar,
  type TransferenciaApi,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ESTADO_NOME = ["Iniciada", "Confirmada", "ConfirmadaComRessalva", "Recusada"] as const;

type TipoRessalva = keyof typeof DISCREPANCY_LABEL | "nenhuma";

function montarRessalva(tipo: TipoRessalva, detalhe: string): string {
  if (tipo === "nenhuma") return "";
  const rotulo = DISCREPANCY_LABEL[tipo];
  const texto = detalhe.trim();
  return texto ? `[${rotulo}] ${texto}` : `[${rotulo}]`;
}

export function TransferenciaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { obterSigner } = useWallet();

  const [transferencia, setTransferencia] = useState<TransferenciaApi | null>(null);
  const [siglas, setSiglas] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState("");

  const [tipoRessalva, setTipoRessalva] = useState<TipoRessalva>("nenhuma");
  const [detalheRessalva, setDetalheRessalva] = useState("");
  const [motivoRecusa, setMotivoRecusa] = useState("");
  const [acao, setAcao] = useState<"confirmar" | "recusar" | null>(null);
  const [erroAcao, setErroAcao] = useState("");
  const [enviando, setEnviando] = useState(false);

  const ressalva = useMemo(
    () => montarRessalva(tipoRessalva, detalheRessalva),
    [tipoRessalva, detalheRessalva],
  );

  useEffect(() => {
    if (!id) return;
    consultarTransferencia(id)
      .then(async (t) => {
        setTransferencia(t);
        const ids = [t.institutionOrigemId, t.institutionDestinoId];
        const pares = await Promise.all(
          ids.map(async (instId) => {
            try {
              const inst = await consultarInstituicao(instId);
              return [instId, inst.sigla] as const;
            } catch {
              return [instId, `Instituição ${instId}`] as const;
            }
          }),
        );
        setSiglas(Object.fromEntries(pares));
      })
      .catch((e) => setErroCarga(e instanceof Error ? e.message : "Falha ao carregar."))
      .finally(() => setCarregando(false));
  }, [id]);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setEnviando(true);
    setErroAcao("");
    try {
      const dadosParaAssinar = await prepararConfirmar(id, ressalva);
      const signer = await obterSigner();
      const assinatura = await assinarComWallet(signer, dadosParaAssinar);
      await relayConfirmar(id, ressalva, [{ endereco: await signer.getAddress(), assinatura }]);
      setTransferencia(await consultarTransferencia(id));
      setAcao(null);
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : "Não foi possível confirmar.");
    } finally {
      setEnviando(false);
    }
  }

  async function recusar(e: React.FormEvent) {
    e.preventDefault();
    if (!id || motivoRecusa.trim().length < 3) return;
    setEnviando(true);
    setErroAcao("");
    try {
      const dadosParaAssinar = await prepararRecusar(id, motivoRecusa);
      const signer = await obterSigner();
      const assinatura = await assinarComWallet(signer, dadosParaAssinar);
      await relayRecusar(id, motivoRecusa, [{ endereco: await signer.getAddress(), assinatura }]);
      setTransferencia(await consultarTransferencia(id));
      setAcao(null);
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : "Não foi possível recusar.");
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </AppShell>
    );
  }

  if (erroCarga || !transferencia) {
    return (
      <AppShell>
        <p className="text-sm text-destructive">{erroCarga || "Transferência não encontrada."}</p>
      </AppShell>
    );
  }

  const estadoNome = ESTADO_NOME[transferencia.estado] ?? String(transferencia.estado);
  const origem = siglas[transferencia.institutionOrigemId] ?? `Instituição ${transferencia.institutionOrigemId}`;
  const destino =
    siglas[transferencia.institutionDestinoId] ?? `Instituição ${transferencia.institutionDestinoId}`;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="rule-label">Transferência #{id}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {origem} → {destino}
          </h1>
        </div>
        <StatusBadge status={estadoNome} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-md border border-border bg-card p-5">
            <SectionTitle title="Dados on-chain" />
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="rule-label">Item (hash único)</dt>
                <dd className="mt-0.5">
                  <Link to={`/bens/${transferencia.itemId}`} className="hover:underline">
                    <Hash value={transferencia.itemId} />
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="rule-label">Lacre físico (hash)</dt>
                <dd className="mt-0.5">
                  <Hash value={transferencia.hashLacre} />
                </dd>
              </div>
              <div>
                <dt className="rule-label">1ª assinatura (origem)</dt>
                <dd className="mt-0.5">{formatDate(transferencia.timestampInicio)}</dd>
              </div>
              {transferencia.timestampConfirmacao ? (
                <div>
                  <dt className="rule-label">2ª assinatura (destino)</dt>
                  <dd className="mt-0.5">{formatDate(transferencia.timestampConfirmacao)}</dd>
                </div>
              ) : null}
              {transferencia.ressalva ? (
                <div className="sm:col-span-2">
                  <dt className="rule-label">Ressalva / motivo</dt>
                  <dd className="mt-0.5 text-destructive">{transferencia.ressalva}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {estadoNome === "Iniciada" ? (
            <section className="rounded-md border border-border bg-card p-5">
              <SectionTitle
                title="Contra-assinatura do destino"
                hint="Confirmar ou recusar exige o threshold de signatários da instituição destino."
              />
              {acao === null ? (
                <div className="flex flex-wrap gap-3">
                  <Button size="sm" onClick={() => setAcao("confirmar")}>
                    Confirmar recebimento
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAcao("recusar")}>
                    Recusar
                  </Button>
                </div>
              ) : acao === "confirmar" ? (
                <form onSubmit={confirmar} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Tipo de ressalva</Label>
                    <Select
                      value={tipoRessalva}
                      onValueChange={(v) => setTipoRessalva(v as TipoRessalva)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sem ressalva" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhuma">Sem ressalva</SelectItem>
                        {Object.entries(DISCREPANCY_LABEL).map(([valor, rotulo]) => (
                          <SelectItem key={valor} value={valor}>
                            {rotulo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Lacre rompido, divergência de peso e item faltante são estados de primeira
                      classe — divergências são registráveis, nunca suprimidas.
                    </p>
                  </div>
                  {tipoRessalva !== "nenhuma" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="detalhe">Detalhe da ressalva (opcional)</Label>
                      <Textarea
                        id="detalhe"
                        rows={3}
                        maxLength={900}
                        value={detalheRessalva}
                        onChange={(e) => setDetalheRessalva(e.target.value)}
                        placeholder="Ex.: peso aferido 1,18 kg; esperado 1,25 kg"
                      />
                    </div>
                  ) : null}
                  {erroAcao ? <p className="text-sm text-destructive">{erroAcao}</p> : null}
                  <div className="flex gap-3">
                    <Button type="submit" size="sm" disabled={enviando}>
                      {enviando
                        ? "Assinando…"
                        : ressalva
                          ? "Confirmar com ressalva"
                          : "Confirmar sem ressalva"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAcao(null)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={recusar} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="motivo">Motivo da recusa</Label>
                    <Textarea
                      id="motivo"
                      rows={3}
                      maxLength={1000}
                      required
                      minLength={3}
                      value={motivoRecusa}
                      onChange={(e) => setMotivoRecusa(e.target.value)}
                    />
                  </div>
                  {erroAcao ? <p className="text-sm text-destructive">{erroAcao}</p> : null}
                  <div className="flex gap-3">
                    <Button type="submit" size="sm" variant="destructive" disabled={enviando}>
                      {enviando ? "Assinando…" : "Recusar recebimento"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAcao(null)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              )}
            </section>
          ) : null}
        </div>

        <aside className="h-fit rounded-md border border-border bg-card p-5">
          <p className="rule-label">O que cada decisão significa</p>
          <ul className="mt-3 space-y-3 text-[13px] leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">Confirmar sem ressalva</strong> — custódia passa
              pra sua instituição, sem divergência registrada.
            </li>
            <li>
              <strong className="text-foreground">Confirmar com ressalva</strong> — custódia passa
              igual, mas a divergência (lacre, peso, item faltante) fica registrada de forma
              permanente.
            </li>
            <li>
              <strong className="text-foreground">Recusar</strong> — custódia permanece com a
              origem. O lacre físico já foi usado nesta tentativa e não pode ser reaproveitado.
            </li>
          </ul>
        </aside>
      </div>
    </AppShell>
  );
}
