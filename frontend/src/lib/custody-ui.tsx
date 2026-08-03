import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<string, string> = {
  Iniciada: "Pendente de contra-assinatura",
  Confirmada: "Confirmada",
  ConfirmadaComRessalva: "Confirmada com ressalva",
  Recusada: "Recusada",
};

export const DISCREPANCY_LABEL: Record<string, string> = {
  lacre_rompido: "Lacre rompido",
  divergencia_peso: "Divergência de peso",
  item_faltante: "Item faltante",
  avaria: "Avaria",
  outro: "Outro",
};

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Iniciada: "bg-warning/15 text-warning-foreground border-warning/40",
    Confirmada: "bg-success/12 text-success border-success/35",
    ConfirmadaComRessalva: "bg-destructive/10 text-destructive border-destructive/35",
    Recusada: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={cn("rounded-sm font-medium", styles[status])}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function Hash({ value, chars = 16 }: { value: string; chars?: number }) {
  if (!value) return null;
  const short = value.length > chars * 2 ? `${value.slice(0, chars)}…${value.slice(-8)}` : value;
  return (
    <span className="hash" title={value}>
      {short}
    </span>
  );
}

export function formatDate(value?: number | string | null) {
  if (!value) return "—";
  const ms = typeof value === "number" ? value * 1000 : Date.parse(value);
  return new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatGrams(value?: number | string | null) {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("pt-BR").format(Number(value))} g`;
}

export function elapsed(fromEpochSeconds?: number | null) {
  if (!fromEpochSeconds) return "—";
  const ms = Date.now() - fromEpochSeconds * 1000;
  const horas = Math.floor(ms / 3600000);
  if (horas < 24) return `${horas} h em aberto`;
  return `${Math.floor(horas / 24)} d ${horas % 24} h em aberto`;
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4 border-b border-border pb-2">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}
