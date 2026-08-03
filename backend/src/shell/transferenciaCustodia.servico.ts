import type { Contract } from "ethers";
import { ordenarAssinaturas, type AssinaturaColetada } from "../domain/transferenciaCustodia.regras";

export type TransferenciaConsultada = {
  itemId: string;
  institutionOrigemId: bigint;
  institutionDestinoId: bigint;
  hashLacre: string;
  estado: number;
  ressalva: string;
  timestampInicio: number;
  timestampConfirmacao: number;
};

export function criarServicoTransferenciaCustodia(contrato: Contract) {
  return {
    async obterNonceInstituicao(institutionId: bigint): Promise<bigint> {
      return contrato.nonces(institutionId);
    },

    async consultarInstituicao(institutionId: bigint) {
      const inst = await contrato.instituicoes(institutionId);
      return {
        sigla: inst.sigla as string,
        threshold: Number(inst.threshold),
        ativa: inst.ativa as boolean,
      };
    },

    async consultarCustodianteAtual(itemId: string): Promise<bigint> {
      return contrato.custodianteInstituicaoAtual(itemId);
    },

    async consultarTransferencia(id: bigint): Promise<TransferenciaConsultada> {
      const t = await contrato.consultar(id);
      return {
        itemId: t.itemId as string,
        institutionOrigemId: t.institutionOrigemId as bigint,
        institutionDestinoId: t.institutionDestinoId as bigint,
        hashLacre: t.hashLacre as string,
        estado: Number(t.estado),
        ressalva: t.ressalva as string,
        timestampInicio: Number(t.timestampInicio),
        timestampConfirmacao: Number(t.timestampConfirmacao),
      };
    },

    async consultarHistoricoItem(itemId: string): Promise<bigint[]> {
      return contrato.consultarHistoricoItem(itemId);
    },

    async iniciarTransferencia(dados: {
      itemId: string;
      institutionDestinoId: bigint;
      hashLacre: string;
      assinaturasColetadas: AssinaturaColetada[];
    }): Promise<{ txHash: string; id: string }> {
      const assinaturas = ordenarAssinaturas(dados.assinaturasColetadas);
      const tx = await contrato.iniciar(dados.itemId, dados.institutionDestinoId, dados.hashLacre, assinaturas);
      const recibo = await tx.wait();
      const evento = recibo.logs
        .map((log: unknown) => {
          try {
            return contrato.interface.parseLog(log as { topics: string[]; data: string });
          } catch {
            return null;
          }
        })
        .find((log: { name: string } | null) => log?.name === "TransferenciaIniciada");
      return { txHash: recibo.hash as string, id: (evento!.args.id as bigint).toString() };
    },

    async confirmarTransferencia(dados: {
      id: bigint;
      ressalva: string;
      assinaturasColetadas: AssinaturaColetada[];
    }): Promise<{ txHash: string }> {
      const assinaturas = ordenarAssinaturas(dados.assinaturasColetadas);
      const tx = await contrato.confirmar(dados.id, dados.ressalva, assinaturas);
      const recibo = await tx.wait();
      return { txHash: recibo.hash as string };
    },

    async recusarTransferencia(dados: {
      id: bigint;
      motivo: string;
      assinaturasColetadas: AssinaturaColetada[];
    }): Promise<{ txHash: string }> {
      const assinaturas = ordenarAssinaturas(dados.assinaturasColetadas);
      const tx = await contrato.recusar(dados.id, dados.motivo, assinaturas);
      const recibo = await tx.wait();
      return { txHash: recibo.hash as string };
    },
  };
}

export type ServicoTransferenciaCustodia = ReturnType<typeof criarServicoTransferenciaCustodia>;
