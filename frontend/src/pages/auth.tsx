import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/lib/wallet";
import { Button } from "@/components/ui/button";

export function Auth() {
  const navigate = useNavigate();
  const { endereco, conectando, erro, conectar } = useWallet();

  useEffect(() => {
    if (endereco) navigate("/painel");
  }, [endereco, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-md border border-border bg-card p-6 text-center">
        <p className="rule-label">Acesso institucional</p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">Conectar carteira</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          As ações on-chain (iniciar, confirmar, recusar transferência) são assinadas pela sua
          própria wallet — o backend nunca vê sua chave privada.
        </p>

        <Button className="mt-5 w-full" onClick={conectar} disabled={conectando}>
          {conectando ? "Conectando…" : "Conectar com MetaMask"}
        </Button>

        {erro ? <p className="mt-3 text-sm text-destructive">{erro}</p> : null}
      </div>
    </div>
  );
}
