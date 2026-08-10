import { Link, NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/painel", label: "Painel" },
  { to: "/bens/novo", label: "Registrar bem" },
  { to: "/transferencias/nova", label: "Nova transferência" },
  { to: "/reconciliacao", label: "Reconciliação" },
  { to: "/demo/declinio-federal", label: "Demo federal" },
] as const;

function truncarEndereco(endereco: string): string {
  return `${endereco.slice(0, 6)}…${endereco.slice(-4)}`;
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { endereco, desconectar } = useWallet();

  function sair() {
    desconectar();
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Link to="/painel" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-primary-foreground/40 text-[11px] font-semibold">
              VC
            </span>
            <span className="text-sm font-semibold tracking-tight">Vinculum Custodiae</span>
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-sm px-2.5 py-1.5 text-[13px] text-primary-foreground/75 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground",
                    isActive && "bg-primary-foreground/15 text-primary-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {endereco ? <span className="hash text-primary-foreground/80">{truncarEndereco(endereco)}</span> : null}
            <Button
              size="sm"
              variant="outline"
              onClick={sair}
              className="h-8 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-6">{children}</main>
    </div>
  );
}
