import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keccak256, toUtf8Bytes } from "ethers";
import { AppShell } from "@/components/app-shell";
import { SectionTitle, Hash } from "@/lib/custody-ui";
import { useWallet } from "@/lib/wallet";
import { criarContratoCustodia } from "@/lib/contrato";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegistrarItem() {
  const navigate = useNavigate();
  const { obterSigner } = useWallet();

  const [institutionId, setInstitutionId] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const itemId = useMemo(() => (codigo.trim() ? keccak256(toUtf8Bytes(codigo.trim())) : ""), [codigo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!institutionId.trim() || !codigo.trim()) {
      setErro("Preencha a instituição e o código do bem.");
      return;
    }
    setEnviando(true);
    try {
      const signer = await obterSigner();
      const contrato = criarContratoCustodia(signer);
      const tx = await contrato.registrarItem(BigInt(institutionId.trim()), itemId);
      await tx.wait();
      navigate(`/bens/${itemId}`);
    } catch (e) {
      setErro(traduzir(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <p className="rule-label">Registro de custódia inicial</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Registrar bem</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={submit} className="rounded-md border border-border bg-card p-5">
          <SectionTitle title="Dados do bem" />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="instituicao">ID da sua instituição</Label>
              <Input
                id="instituicao"
                placeholder="1"
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código interno do bem</Label>
              <Input
                id="codigo"
                placeholder="policia-civil:bo-2024-000042"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Vira o hash único do item (itemId), calculado no seu navegador — o mesmo código
                sempre gera o mesmo hash.
              </p>
              {itemId ? (
                <p className="mt-1">
                  <Hash value={itemId} />
                </p>
              ) : null}
            </div>

            {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

            <Button type="submit" disabled={enviando}>
              {enviando ? "Assinando…" : "Registrar bem"}
            </Button>
          </div>
        </form>

        <aside className="h-fit rounded-md border border-border bg-card p-5">
          <p className="rule-label">O que acontece ao registrar</p>
          <ol className="mt-3 space-y-3 text-[13px] leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">1.</strong> Sua wallet assina a transação
              diretamente com o contrato — não passa pelo backend.
            </li>
            <li>
              <strong className="text-foreground">2.</strong> Você precisa ser signatário da
              instituição informada. Um item só pode ser registrado uma vez.
            </li>
            <li>
              <strong className="text-foreground">3.</strong> A partir daqui, sua instituição é a
              custodiante inicial — só ela pode iniciar a primeira transferência deste item.
            </li>
          </ol>
        </aside>
      </div>
    </AppShell>
  );
}

function traduzir(erro: unknown): string {
  const msg = erro instanceof Error ? erro.message : String(erro);
  if (msg.includes("item ja registrado")) return "Esse código já foi registrado antes.";
  if (msg.includes("nao e signatario da instituicao"))
    return "Sua wallet não é signatária dessa instituição.";
  return msg;
}
