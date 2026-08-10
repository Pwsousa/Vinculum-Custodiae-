import type { RegistroCanonico, RegistroPoliciaCivil, RegistroSisbemjud } from "./normalizar";
import { normalizarPoliciaCivil, normalizarSisbemjud } from "./normalizar";

export type TipoRessalva =
  | "lacre_rompido"
  | "divergencia_peso"
  | "item_faltante"
  | "avaria"
  | "outro";

export const TIPOS_RESSALVA: { valor: TipoRessalva; rotulo: string }[] = [
  { valor: "lacre_rompido", rotulo: "Lacre rompido" },
  { valor: "divergencia_peso", rotulo: "Divergência de peso" },
  { valor: "item_faltante", rotulo: "Item faltante" },
  { valor: "avaria", rotulo: "Avaria" },
  { valor: "outro", rotulo: "Outro" },
];

const ROTULO: Record<TipoRessalva, string> = Object.fromEntries(
  TIPOS_RESSALVA.map((t) => [t.valor, t.rotulo]),
) as Record<TipoRessalva, string>;

/**
 * Serializa ressalva tipada para a string on-chain.
 * Formato: "[CATEGORIA] detalhe opcional"
 */
export function formatarRessalva(tipo: TipoRessalva, detalhe?: string): string {
  const rotulo = ROTULO[tipo] ?? tipo;
  const texto = detalhe?.trim();
  return texto ? `[${rotulo}] ${texto}` : `[${rotulo}]`;
}

export function parsearRessalva(ressalva: string): { tipo?: string; detalhe: string } {
  const match = ressalva.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!match) return { detalhe: ressalva };
  return { tipo: match[1], detalhe: match[2] };
}

export type VisaoBrutaSistemas = {
  sisbemjud: RegistroSisbemjud | null;
  policiaCivil: RegistroPoliciaCivil | null;
};

export type ResultadoReconciliacao = {
  chave: string;
  brutos: VisaoBrutaSistemas;
  canonicos: {
    sisbemjud: RegistroCanonico | null;
    policiaCivil: RegistroCanonico | null;
  };
  convergencias: string[];
  divergencias: string[];
  observacao: string;
};

export function reconciliarRegistros(
  chave: string,
  brutos: VisaoBrutaSistemas,
): ResultadoReconciliacao {
  const canonicos = {
    sisbemjud: brutos.sisbemjud ? normalizarSisbemjud(brutos.sisbemjud) : null,
    policiaCivil: brutos.policiaCivil ? normalizarPoliciaCivil(brutos.policiaCivil) : null,
  };

  const convergencias: string[] = [];
  const divergencias: string[] = [];

  if (canonicos.sisbemjud && canonicos.policiaCivil) {
    if (canonicos.sisbemjud.enderecoBlockchain === canonicos.policiaCivil.enderecoBlockchain) {
      convergencias.push("enderecoBlockchain idêntico após normalização");
    } else {
      divergencias.push("enderecoBlockchain diverge entre Sisbemjud e Polícia Civil");
    }

    if (
      canonicos.sisbemjud.numeroLacre.toLowerCase() ===
      canonicos.policiaCivil.numeroLacre.toLowerCase()
    ) {
      convergencias.push("numeroLacre coincidente (após apara)");
    } else {
      divergencias.push(
        `lacres distintos: judicial="${canonicos.sisbemjud.numeroLacre}" vs policial="${canonicos.policiaCivil.numeroLacre}"`,
      );
    }

    if (canonicos.sisbemjud.dataEvento === canonicos.policiaCivil.dataEvento) {
      convergencias.push("dataEvento coincidente após normalização de formato");
    } else {
      divergencias.push(
        `datas distintas: depósito=${canonicos.sisbemjud.dataEvento} vs apreensão=${canonicos.policiaCivil.dataEvento}`,
      );
    }
  } else if (!canonicos.sisbemjud && !canonicos.policiaCivil) {
    divergencias.push("nenhum dos sistemas institucionais retornou registro para esta chave");
  } else if (!canonicos.sisbemjud) {
    divergencias.push("Sisbemjud não possui espelho deste bem");
  } else {
    divergencias.push("Polícia Civil não possui espelho deste bem");
  }

  return {
    chave,
    brutos,
    canonicos,
    convergencias,
    divergencias,
    observacao:
      "Cada instituição mantém o próprio esquema. A blockchain registra apenas o evento de transferência de custódia (quem entregou, quem recebeu, quando, sob qual lacre) e atua como camada de reconciliação interinstitucional.",
  };
}
