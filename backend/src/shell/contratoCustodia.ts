import { Contract, type Wallet } from "ethers";
import { abiTransferenciaCustodia, enderecosTransferenciaCustodia } from "@vinculum-custodiae/abi";

export function obterEnderecoContrato(rede: string): string {
  const endereco = (enderecosTransferenciaCustodia as Record<string, string>)[rede];
  if (!endereco) {
    throw new Error(`Endereco de TransferenciaCustodia nao encontrado pra rede "${rede}" em enderecos.json`);
  }
  return endereco;
}

export function criarContratoCustodia(wallet: Wallet, rede: string): Contract {
  return new Contract(obterEnderecoContrato(rede), abiTransferenciaCustodia, wallet);
}
