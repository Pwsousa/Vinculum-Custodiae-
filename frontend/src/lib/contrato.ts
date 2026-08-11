import { Contract, type JsonRpcSigner } from "ethers";
import { abiTransferenciaCustodia, enderecosTransferenciaCustodia } from "@vinculum-custodiae/abi";

const REDE = import.meta.env.VITE_REDE_CONTRATO ?? "localhost";

export function obterEnderecoContrato(): string {
  const endereco = (enderecosTransferenciaCustodia as Record<string, string>)[REDE];
  if (!endereco) {
    throw new Error(`Endereço do contrato não encontrado para a rede "${REDE}" em enderecos.json`);
  }
  return endereco;
}

/**
 * registrarItem exige que msg.sender seja o próprio signatário da instituição — não dá
 * pra relayar pelo backend. Front chama o contrato direto com a wallet conectada.
 */
export function criarContratoCustodia(signer: JsonRpcSigner): Contract {
  return new Contract(obterEnderecoContrato(), abiTransferenciaCustodia, signer);
}
