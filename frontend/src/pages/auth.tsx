import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@/lib/wallet";
import { Button } from "@/components/ui/button";

export function Auth() {
  const navigate = useNavigate();
  const { endereco, conectando, erro, conectar } = useWallet();

  useEffect(() => {
    if (endereco) navigate("/painel");
  }, [endereco, navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-72 w-[32rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(0.36_0.086_258/0.1),transparent_70%)]" />
      </div>

      <div className="relative w-full max-w-sm rounded-md border border-border bg-card p-6 text-center shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
        <Link to="/" className="rule-label hover:text-foreground">
          Vinculum Custodiae
        </Link>
        <h1 className="mt-2 text-lg font-semibold tracking-tight">Acesso institucional</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          As ações on-chain (iniciar, confirmar, recusar) são assinadas pela sua própria wallet —
          o backend nunca vê sua chave privada.
        </p>

        <Button className="mt-5 w-full" onClick={conectar} disabled={conectando}>
          {conectando ? "Conectando…" : "Conectar com MetaMask"}
        </Button>

        {erro ? <p className="mt-3 text-sm text-destructive">{erro}</p> : null}

        <p className="mt-5 text-xs text-muted-foreground">
          Após conectar, use o painel da sua instituição ou consulte a{" "}
          <Link to="/demo/declinio-federal" className="text-primary hover:underline">
            demo federal
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
