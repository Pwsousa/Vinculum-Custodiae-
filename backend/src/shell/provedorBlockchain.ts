import { JsonRpcProvider, Wallet } from "ethers";

export function criarProvedor(rpcUrl: string): JsonRpcProvider {
  return new JsonRpcProvider(rpcUrl);
}

/**
 * Wallet relayer: paga o gás e envia iniciar/confirmar/recusar. Não precisa ser
 * signatário de nenhuma instituição — o contrato valida autoridade pelas assinaturas
 * EIP-712 anexadas, não por quem envia a transação.
 */
export function criarWalletRelayer(chavePrivada: string, provedor: JsonRpcProvider): Wallet {
  if (!chavePrivada) throw new Error("PRIVATE_KEY_RELAYER nao configurada");
  return new Wallet(chavePrivada, provedor);
}
