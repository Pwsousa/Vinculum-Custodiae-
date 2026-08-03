import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { SectionTitle } from "@/lib/custody-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Painel() {
  const navigate = useNavigate();
  const [idTransferencia, setIdTransferencia] = useState("");
  const [itemId, setItemId] = useState("");

  function abrirTransferencia(e: React.FormEvent) {
    e.preventDefault();
    if (idTransferencia.trim()) navigate(`/transferencias/${idTransferencia.trim()}`);
  }

  function abrirHistoricoItem(e: React.FormEvent) {
    e.preventDefault();
    if (itemId.trim()) navigate(`/bens/${itemId.trim()}`);
  }

  return (
    <AppShell>
      <div className="mb-6">
        <p className="rule-label">Painel de custódia</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">O que você quer consultar?</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-md border border-border bg-card p-5">
          <SectionTitle title="Abrir transferência por ID" />
          <form onSubmit={abrirTransferencia} className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="id-transferencia">ID da transferência</Label>
              <Input
                id="id-transferencia"
                placeholder="1"
                value={idTransferencia}
                onChange={(e) => setIdTransferencia(e.target.value)}
              />
            </div>
            <Button type="submit" className="mt-6">
              Abrir
            </Button>
          </form>
        </section>

        <section className="rounded-md border border-border bg-card p-5">
          <SectionTitle title="Consultar cadeia de custódia de um item" />
          <form onSubmit={abrirHistoricoItem} className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="item-id">Hash do item (itemId)</Label>
              <Input
                id="item-id"
                placeholder="0x…"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
              />
            </div>
            <Button type="submit" variant="outline" className="mt-6">
              Consultar
            </Button>
          </form>
        </section>
      </div>

      <div className="mt-8">
        <Button asChild>
          <Link to="/transferencias/nova">Nova transferência</Link>
        </Button>
      </div>
    </AppShell>
  );
}
