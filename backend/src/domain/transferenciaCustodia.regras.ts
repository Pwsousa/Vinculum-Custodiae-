import { keccak256, toUtf8Bytes } from "ethers";

export enum Estado {
  Iniciada = 0,
  Confirmada = 1,
  ConfirmadaComRessalva = 2,
}

export function calcularHashLacre(numeroLacre: string): string {
  return keccak256(toUtf8Bytes(numeroLacre));
}

export function avaliarConfirmacao(ressalva: string): Estado {
  return ressalva.trim().length > 0 ? Estado.ConfirmadaComRessalva : Estado.Confirmada;
}

export function podeIniciar(enderecoOrigem: string, enderecoDestino: string): boolean {
  return enderecoOrigem.toLowerCase() !== enderecoDestino.toLowerCase();
}
