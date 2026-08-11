import { keccak256, toUtf8Bytes } from "ethers";

/**
 * Espelha os typehashes de TransferenciaCustodia.sol. Qualquer mudança de campo aqui
 * sem a mudança equivalente no contrato quebra a verificação de assinatura on-chain.
 */
export const TIPOS_EIP712 = {
  IniciarTransferencia: [
    { name: "itemId", type: "bytes32" },
    { name: "institutionOrigemId", type: "uint256" },
    { name: "institutionDestinoId", type: "uint256" },
    { name: "hashLacre", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
  ConfirmarTransferencia: [
    { name: "transferenciaId", type: "uint256" },
    { name: "hashRessalva", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
  RecusarTransferencia: [
    { name: "transferenciaId", type: "uint256" },
    { name: "hashMotivo", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export type DominioEip712 = {
  name: "TransferenciaCustodia";
  version: "1";
  chainId: bigint;
  verifyingContract: string;
};

export function construirDominio(chainId: bigint, enderecoContrato: string): DominioEip712 {
  return { name: "TransferenciaCustodia", version: "1", chainId, verifyingContract: enderecoContrato };
}

export function valorIniciarTransferencia(dados: {
  itemId: string;
  institutionOrigemId: bigint;
  institutionDestinoId: bigint;
  hashLacre: string;
  nonce: bigint;
}) {
  return dados;
}

export function valorConfirmarTransferencia(dados: {
  transferenciaId: bigint;
  ressalva: string;
  nonce: bigint;
}) {
  return {
    transferenciaId: dados.transferenciaId,
    hashRessalva: keccak256(toUtf8Bytes(dados.ressalva)),
    nonce: dados.nonce,
  };
}

export function valorRecusarTransferencia(dados: { transferenciaId: bigint; motivo: string; nonce: bigint }) {
  return {
    transferenciaId: dados.transferenciaId,
    hashMotivo: keccak256(toUtf8Bytes(dados.motivo)),
    nonce: dados.nonce,
  };
}
