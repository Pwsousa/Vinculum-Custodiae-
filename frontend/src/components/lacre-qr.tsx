import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  label?: string;
  size?: number;
  className?: string;
};

/** QR do lacre físico — valor legível no selo (não o hash on-chain). */
export function LacreQr({ value, label = "Lacre físico", size = 140, className }: Props) {
  if (!value.trim()) return null;
  return (
    <div className={cn("inline-flex flex-col items-center gap-2", className)}>
      <div className="rounded-md border border-border bg-white p-3 shadow-sm">
        <QRCodeSVG value={value.trim()} size={size} level="M" includeMargin={false} />
      </div>
      <div className="text-center">
        <p className="rule-label">{label}</p>
        <p className="mt-0.5 font-mono text-xs text-foreground">{value.trim()}</p>
      </div>
    </div>
  );
}
