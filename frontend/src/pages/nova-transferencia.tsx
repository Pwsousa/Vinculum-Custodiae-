import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { SectionTitle } from "@/lib/custody-ui";
import { useWallet } from "@/lib/wallet";
import { assinarComWallet, prepararIniciar, relayIniciar } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NovaTransferencia() {
  const navigate = useNavigate();
  const { obterSigner } = useWallet();

  const [itemId, setItemId] = useState("");
  const [institutionDestinoId, setInstitutionDestinoId] = useState("");
  const [hashLacre, setHashLacre] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!itemId.trim() || !institutionDestinoId.trim() || !hashLacre.trim()) {
      setErro("Preencha item, instituição destino e lacre.");
      return;
    }
    setEnviando(true);
    try {
      const dadosParaAssinar = await prepararIniciar({
        itemId: itemId.trim(),
        institutionDestinoId: institutionDestinoId.trim(),
        hashLacre: hashLacre.trim(),
      });
      const signer = await obterSigner();
      const assinatura = await assinarComWallet(signer, dadosParaAssinar);
      const resultado = await relayIniciar({
        itemId: itemId.trim(),
        institutionDestinoId: institutionDestinoId.trim(),
        hashLacre: hashLacre.trim(),
        assinaturas: [{ endereco: await signer.getAddress(), assinatura }],
      });
      navigate(`/transferencias/${resultado.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível iniciar a transferência.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <p className="rule-label">Contrato de transferência — 1ª assinatura</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Nova transferência de custódia</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={submit} className="rounded-md border border-border bg-card p-5">
          <SectionTitle title="Dados da remessa" />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="item">Item (hash único, registrado previamente)</Label>
              <Input
                id="item"
                placeholder="0x…"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="destino">ID da instituição destinatária</Label>
              <Input
                id="destino"
                placeholder="2"
                value={institutionDestinoId}
                onChange={(e) => setInstitutionDestinoId(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lacre">Hash do lacre físico</Label>
              <Input
                id="lacre"
                placeholder="0x…"
                value={hashLacre}
                onChange={(e) => setHashLacre(e.target.value)}
              />
            </div>

            {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

            <Button type="submit" disabled={enviando}>
              {enviando ? "Assinando…" : "Assinar remessa"}
            </Button>
          </div>
        </form>

        <aside className="h-fit rounded-md border border-border bg-card p-5">
          <p className="rule-label">O que acontece ao assinar</p>
          <ol className="mt-3 space-y-3 text-[13px] leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">1.</strong> Sua wallet assina a transferência
              (EIP-712) — a chave privada nunca sai do navegador.
            </li>
            <li>
              <strong className="text-foreground">2.</strong> O backend relay a transação
              on-chain. A custódia <strong className="text-foreground">permanece com sua
              instituição</strong> até a contra-assinatura do destinatário.
            </li>
            <li>
              <strong className="text-foreground">3.</strong> Se a instituição de origem exigir
              mais de uma assinatura (threshold {'>'} 1), outros signatários precisam assinar o
              mesmo lote antes do relay ser aceito.
            </li>
          </ol>
        </aside>
      </div>
    </AppShell>
  );
}
