import type { JsonRpcSigner } from "ethers";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const corpo = await resposta.json();
  if (!resposta.ok) {
    throw new Error(typeof corpo?.message === "string" ? corpo.message : "Falha na requisição");
  }
  return corpo as T;
}

export type TransferenciaApi = {
  id: string;
  itemId: string;
  institutionOrigemId: string;
  institutionDestinoId: string;
  hashLacre: string;
  estado: number;
  ressalva: string;
  timestampInicio: number;
  timestampConfirmacao: number;
};

export type DadosParaAssinar = {
  dominio: { name: string; version: string; chainId: string; verifyingContract: string };
  tipos: Record<string, { name: string; type: string }[]>;
  valor: Record<string, unknown>;
};

export type AssinaturaEnviada = { endereco: string; assinatura: string };

/**
 * Converte a resposta de um endpoint "preparar-*" (campos uint256 vem como string,
 * pois BigInt não serializa em JSON) de volta pro formato que signTypedData espera,
 * e assina com a wallet conectada.
 */
export async function assinarComWallet(signer: JsonRpcSigner, dados: DadosParaAssinar): Promise<string> {
  const nomeTipo = Object.keys(dados.tipos)[0];
  const campos = dados.tipos[nomeTipo];
  const dominio = { ...dados.dominio, chainId: BigInt(dados.dominio.chainId) };
  const valor: Record<string, unknown> = {};
  for (const campo of campos) {
    const valorCodificado = dados.valor[campo.name];
    valor[campo.name] = campo.type === "uint256" ? BigInt(valorCodificado as string) : valorCodificado;
  }
  return signer.signTypedData(dominio, { [nomeTipo]: campos }, valor);
}

export function consultarTransferencia(id: string) {
  return requisitar<TransferenciaApi>(`/transferencias/${id}`);
}

export function consultarHistoricoItem(itemId: string) {
  return requisitar<{ transferencias: TransferenciaApi[] }>(`/bens/${itemId}/historico`);
}

export function consultarCustodiante(itemId: string) {
  return requisitar<{ institutionId: string }>(`/bens/${itemId}/custodiante`);
}

export function consultarInstituicao(id: string) {
  return requisitar<{ sigla: string; threshold: number; ativa: boolean }>(`/instituicoes/${id}`);
}

export function consultarItensDaInstituicao(id: string) {
  return requisitar<{ itens: string[] }>(`/instituicoes/${id}/itens`);
}

export function consultarTransferenciasDaInstituicao(id: string) {
  return requisitar<{ transferencias: TransferenciaApi[] }>(`/instituicoes/${id}/transferencias`);
}

export function prepararIniciar(dados: { itemId: string; institutionDestinoId: string; hashLacre: string }) {
  const params = new URLSearchParams(dados);
  return requisitar<DadosParaAssinar>(`/transferencias/preparar-iniciar?${params}`);
}

export function prepararConfirmar(id: string, ressalva: string) {
  const params = new URLSearchParams({ ressalva });
  return requisitar<DadosParaAssinar>(`/transferencias/${id}/preparar-confirmar?${params}`);
}

export function prepararRecusar(id: string, motivo: string) {
  const params = new URLSearchParams({ motivo });
  return requisitar<DadosParaAssinar>(`/transferencias/${id}/preparar-recusar?${params}`);
}

export function relayIniciar(dados: {
  itemId: string;
  institutionDestinoId: string;
  hashLacre: string;
  assinaturas: AssinaturaEnviada[];
}) {
  return requisitar<{ txHash: string; id: string }>("/transferencias/iniciar", {
    method: "POST",
    body: JSON.stringify(dados),
  });
}

export function relayConfirmar(id: string, ressalva: string, assinaturas: AssinaturaEnviada[]) {
  return requisitar<{ txHash: string }>(`/transferencias/${id}/confirmar`, {
    method: "POST",
    body: JSON.stringify({ ressalva, assinaturas }),
  });
}

export function relayRecusar(id: string, motivo: string, assinaturas: AssinaturaEnviada[]) {
  return requisitar<{ txHash: string }>(`/transferencias/${id}/recusar`, {
    method: "POST",
    body: JSON.stringify({ motivo, assinaturas }),
  });
}

export type TipoRessalvaApi = { valor: string; rotulo: string };

export type ResultadoReconciliacaoApi = {
  chave: string;
  brutos: {
    sisbemjud: Record<string, unknown> | null;
    policiaCivil: Record<string, unknown> | null;
  };
  canonicos: {
    sisbemjud: Record<string, unknown> | null;
    policiaCivil: Record<string, unknown> | null;
  };
  convergencias: string[];
  divergencias: string[];
  observacao: string;
};

export function listarTiposRessalva() {
  return requisitar<{ tipos: TipoRessalvaApi[] }>("/ressalvas/tipos");
}

export function listarSistemasInstitucionais() {
  return requisitar<{
    sisbemjud: { sistema: string; esquema: string; bens: Record<string, unknown>[] };
    policiaCivil: {
      sistema: string;
      esquema: string;
      apreensoes: Record<string, unknown>[];
    };
  }>("/reconciliacao/sistemas");
}

export function reconciliarItem(itemId: string) {
  return requisitar<ResultadoReconciliacaoApi>(`/reconciliacao/item/${encodeURIComponent(itemId)}`);
}
