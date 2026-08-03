import { keccak256, toUtf8Bytes } from "ethers";

export enum Estado {
  Iniciada = 0,
  Confirmada = 1,
  ConfirmadaComRessalva = 2,
  Recusada = 3,
}

export type AssinaturaColetada = {
  endereco: string;
  assinatura: string;
};

export function calcularHashLacre(numeroLacre: string): string {
  return keccak256(toUtf8Bytes(numeroLacre));
}

export function calcularItemId(identificadorInterno: string): string {
  return keccak256(toUtf8Bytes(identificadorInterno));
}

export function avaliarConfirmacao(ressalva: string): Estado {
  return ressalva.trim().length > 0 ? Estado.ConfirmadaComRessalva : Estado.Confirmada;
}

export function podeIniciar(institutionOrigemId: bigint, institutionDestinoId: bigint): boolean {
  return institutionOrigemId !== institutionDestinoId;
}

/**
 * Ordena assinaturas coletadas por endereço crescente — o contrato exige essa ordem
 * pra verificar o multisig sem precisar de um set em memória (barra duplicidade de assinante).
 */
export function ordenarAssinaturas(coletadas: AssinaturaColetada[]): string[] {
  return [...coletadas]
    .sort((a, b) => (a.endereco.toLowerCase() < b.endereco.toLowerCase() ? -1 : 1))
    .map((c) => c.assinatura);
}

export function thresholdAtingido(coletadas: AssinaturaColetada[], threshold: number): boolean {
  const enderecosUnicos = new Set(coletadas.map((c) => c.endereco.toLowerCase()));
  return enderecosUnicos.size >= threshold;
}
