import type { Contract, EventLog } from "ethers";
import { ordenarAssinaturas, type AssinaturaColetada } from "../domain/transferenciaCustodia.regras";

export type TransferenciaConsultada = {
  id: string;
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
  async function consultarTransferencia(id: bigint): Promise<TransferenciaConsultada> {
    const t = await contrato.consultar(id);
    return {
      id: id.toString(),
      itemId: t.itemId as string,
      institutionOrigemId: t.institutionOrigemId as bigint,
      institutionDestinoId: t.institutionDestinoId as bigint,
      hashLacre: t.hashLacre as string,
      estado: Number(t.estado),
      ressalva: t.ressalva as string,
      timestampInicio: Number(t.timestampInicio),
      timestampConfirmacao: Number(t.timestampConfirmacao),
    };
  }

  return {
    consultarTransferencia,

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

    async consultarHistoricoItem(itemId: string): Promise<bigint[]> {
      return contrato.consultarHistoricoItem(itemId);
    },

    /**
     * O contrato não guarda "lista de itens da instituição X" — só custodianteInstituicaoAtual
     * por item. Reconstrói via eventos (ItemRegistrado e CustodiaAlterada, ambos indexados por
     * institutionId) pra achar candidatos, depois confirma qual deles ainda está com X agora.
     */
    async listarItensDaInstituicao(institutionId: bigint): Promise<string[]> {
      const [registrados, custodiaAlterada] = await Promise.all([
        contrato.queryFilter(contrato.filters.ItemRegistrado(null, institutionId)),
        contrato.queryFilter(contrato.filters.CustodiaAlterada(null, institutionId)),
      ]);
      const candidatos = new Set<string>();
      for (const evento of [...registrados, ...custodiaAlterada]) {
        candidatos.add((evento as EventLog).args.itemId as string);
      }
      const atuais: string[] = [];
      for (const itemId of candidatos) {
        const custodianteAtual = await contrato.custodianteInstituicaoAtual(itemId);
        if (custodianteAtual === institutionId) atuais.push(itemId);
      }
      return atuais;
    },

    /**
     * institutionOrigemId/institutionDestinoId não são indexados no evento TransferenciaIniciada,
     * então busca todos os eventos e filtra em memória — aceitável na escala de uma PoC.
     */
    async listarTransferenciasDaInstituicao(institutionId: bigint): Promise<TransferenciaConsultada[]> {
      const eventos = await contrato.queryFilter(contrato.filters.TransferenciaIniciada());
      const idsRelevantes = eventos
        .map((evento) => (evento as EventLog).args)
        .filter((args) => args.institutionOrigemId === institutionId || args.institutionDestinoId === institutionId)
        .map((args) => args.id as bigint);
      return Promise.all(idsRelevantes.map((id) => consultarTransferencia(id)));
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
