import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { keccak256, toUtf8Bytes } from "ethers";
import { AppShell } from "@/components/app-shell";
import { LacreQr } from "@/components/lacre-qr";
import { Hash, SectionTitle } from "@/lib/custody-ui";
import { useWallet } from "@/lib/wallet";
import { assinarComWallet, prepararIniciar, relayIniciar } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NovaTransferencia() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { obterSigner } = useWallet();

  const [itemId, setItemId] = useState(() => searchParams.get("itemId") ?? "");
  const [institutionDestinoId, setInstitutionDestinoId] = useState("");
  const [numeroLacre, setNumeroLacre] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const hashLacre = useMemo(
    () => (numeroLacre.trim() ? keccak256(toUtf8Bytes(numeroLacre.trim())) : ""),
    [numeroLacre],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!itemId.trim() || !institutionDestinoId.trim() || !numeroLacre.trim()) {
      setErro("Preencha item, instituição destino e número do lacre físico.");
      return;
    }
    setEnviando(true);
    try {
      const dadosParaAssinar = await prepararIniciar({
        itemId: itemId.trim(),
        institutionDestinoId: institutionDestinoId.trim(),
        hashLacre,
      });
      const signer = await obterSigner();
      const assinatura = await assinarComWallet(signer, dadosParaAssinar);
      const resultado = await relayIniciar({
        itemId: itemId.trim(),
        institutionDestinoId: institutionDestinoId.trim(),
        hashLacre,
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
              <Label htmlFor="lacre">Número do lacre físico (ID / QR)</Label>
              <Input
                id="lacre"
                placeholder="LP-2233-QR"
                value={numeroLacre}
                onChange={(e) => setNumeroLacre(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                O hash on-chain é calculado no navegador a partir do ID impresso no lacre. Cada
                lacre só pode ser usado uma vez.
              </p>
              {hashLacre ? (
                <p className="mt-1">
                  Hash: <Hash value={hashLacre} />
                </p>
              ) : null}
            </div>

            {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

            <Button type="submit" disabled={enviando}>
              {enviando ? "Assinando…" : "Assinar remessa"}
            </Button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="flex justify-center rounded-md border border-border bg-card p-5">
            {numeroLacre.trim() ? (
              <LacreQr value={numeroLacre.trim()} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Informe o número do lacre para gerar o QR Code.
              </p>
            )}
          </div>

          <div className="h-fit rounded-md border border-border bg-card p-5">
            <p className="rule-label">O que acontece ao assinar</p>
            <ol className="mt-3 space-y-3 text-[13px] leading-relaxed text-muted-foreground">
              <li>
                <strong className="text-foreground">1.</strong> Sua wallet assina a transferência
                (EIP-712) — a chave privada nunca sai do navegador.
              </li>
              <li>
                <strong className="text-foreground">2.</strong> O backend relay a transação
                on-chain. A custódia{" "}
                <strong className="text-foreground">permanece com sua instituição</strong> até a
                contra-assinatura do destinatário.
              </li>
              <li>
                <strong className="text-foreground">3.</strong> Se a instituição de origem exigir
                mais de uma assinatura (threshold {'>'} 1), outros signatários precisam assinar o
                mesmo lote antes do relay ser aceito.
              </li>
            </ol>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
