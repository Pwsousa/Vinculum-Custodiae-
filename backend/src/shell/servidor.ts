import Fastify from "fastify";
import cors from "@fastify/cors";
import type { Contract, JsonRpcProvider } from "ethers";
import { configuracao } from "./config";
import { criarProvedor, criarWalletRelayer } from "./provedorBlockchain";
import { criarContratoCustodia } from "./contratoCustodia";
import { criarServicoTransferenciaCustodia, type TransferenciaConsultada } from "./transferenciaCustodia.servico";
import {
  construirDominio,
  TIPOS_EIP712,
  valorConfirmarTransferencia,
  valorIniciarTransferencia,
  valorRecusarTransferencia,
} from "../domain/eip712CustodiaTransferencia";

type AssinaturaRecebida = { endereco: string; assinatura: string };

async function obterDominio(provedor: JsonRpcProvider, contrato: Contract) {
  const rede = await provedor.getNetwork();
  return construirDominio(rede.chainId, await contrato.getAddress());
}

export async function criarServidor() {
  const provedor = criarProvedor(configuracao.rpcUrl);
  const wallet = criarWalletRelayer(configuracao.chavePrivadaRelayer, provedor);
  const contrato = criarContratoCustodia(wallet, configuracao.rede);
  const servico = criarServicoTransferenciaCustodia(contrato);

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get("/transferencias/:id", async (req) => {
    const { id } = req.params as { id: string };
    const t = await servico.consultarTransferencia(BigInt(id));
    return serializarTransferencia(t);
  });

  app.get("/bens/:itemId/historico", async (req) => {
    const { itemId } = req.params as { itemId: string };
    const ids = await servico.consultarHistoricoItem(itemId);
    const transferencias = await Promise.all(ids.map((tid) => servico.consultarTransferencia(tid)));
    return { transferencias: transferencias.map(serializarTransferencia) };
  });

  app.get("/bens/:itemId/custodiante", async (req) => {
    const { itemId } = req.params as { itemId: string };
    const institutionId = await servico.consultarCustodianteAtual(itemId);
    return { institutionId: institutionId.toString() };
  });

  app.get("/instituicoes/:id", async (req) => {
    const { id } = req.params as { id: string };
    return servico.consultarInstituicao(BigInt(id));
  });

  app.get("/instituicoes/:id/nonce", async (req) => {
    const { id } = req.params as { id: string };
    const nonce = await servico.obterNonceInstituicao(BigInt(id));
    return { nonce: nonce.toString() };
  });

  app.get("/instituicoes/:id/itens", async (req) => {
    const { id } = req.params as { id: string };
    const itens = await servico.listarItensDaInstituicao(BigInt(id));
    return { itens };
  });

  app.get("/instituicoes/:id/transferencias", async (req) => {
    const { id } = req.params as { id: string };
    const transferencias = await servico.listarTransferenciasDaInstituicao(BigInt(id));
    return { transferencias: transferencias.map(serializarTransferencia) };
  });

  // ---------- Preparo de assinatura (o front assina isto com a wallet da instituição) ----------

  app.get("/transferencias/preparar-iniciar", async (req) => {
    const { itemId, institutionDestinoId, hashLacre } = req.query as {
      itemId: string;
      institutionDestinoId: string;
      hashLacre: string;
    };
    const institutionOrigemId = await servico.consultarCustodianteAtual(itemId);
    const nonce = await servico.obterNonceInstituicao(institutionOrigemId);
    return {
      dominio: dominioSerializavel(await obterDominio(provedor, contrato)),
      tipos: { IniciarTransferencia: TIPOS_EIP712.IniciarTransferencia },
      valor: valorSerializavel(
        valorIniciarTransferencia({
          itemId,
          institutionOrigemId,
          institutionDestinoId: BigInt(institutionDestinoId),
          hashLacre,
          nonce,
        }),
      ),
    };
  });

  app.get("/transferencias/:id/preparar-confirmar", async (req) => {
    const { id } = req.params as { id: string };
    const { ressalva } = req.query as { ressalva?: string };
    const t = await servico.consultarTransferencia(BigInt(id));
    const nonce = await servico.obterNonceInstituicao(t.institutionDestinoId);
    return {
      dominio: dominioSerializavel(await obterDominio(provedor, contrato)),
      tipos: { ConfirmarTransferencia: TIPOS_EIP712.ConfirmarTransferencia },
      valor: valorSerializavel(
        valorConfirmarTransferencia({ transferenciaId: BigInt(id), ressalva: ressalva ?? "", nonce }),
      ),
    };
  });

  app.get("/transferencias/:id/preparar-recusar", async (req) => {
    const { id } = req.params as { id: string };
    const { motivo } = req.query as { motivo?: string };
    const t = await servico.consultarTransferencia(BigInt(id));
    const nonce = await servico.obterNonceInstituicao(t.institutionDestinoId);
    return {
      dominio: dominioSerializavel(await obterDominio(provedor, contrato)),
      tipos: { RecusarTransferencia: TIPOS_EIP712.RecusarTransferencia },
      valor: valorSerializavel(
        valorRecusarTransferencia({ transferenciaId: BigInt(id), motivo: motivo ?? "", nonce }),
      ),
    };
  });

  // ---------- Relay (assinaturas ja coletadas no front) ----------

  app.post("/transferencias/iniciar", async (req) => {
    const corpo = req.body as {
      itemId: string;
      institutionDestinoId: string;
      hashLacre: string;
      assinaturas: AssinaturaRecebida[];
    };
    return servico.iniciarTransferencia({
      itemId: corpo.itemId,
      institutionDestinoId: BigInt(corpo.institutionDestinoId),
      hashLacre: corpo.hashLacre,
      assinaturasColetadas: corpo.assinaturas,
    });
  });

  app.post("/transferencias/:id/confirmar", async (req) => {
    const { id } = req.params as { id: string };
    const corpo = req.body as { ressalva: string; assinaturas: AssinaturaRecebida[] };
    return servico.confirmarTransferencia({
      id: BigInt(id),
      ressalva: corpo.ressalva,
      assinaturasColetadas: corpo.assinaturas,
    });
  });

  app.post("/transferencias/:id/recusar", async (req) => {
    const { id } = req.params as { id: string };
    const corpo = req.body as { motivo: string; assinaturas: AssinaturaRecebida[] };
    return servico.recusarTransferencia({
      id: BigInt(id),
      motivo: corpo.motivo,
      assinaturasColetadas: corpo.assinaturas,
    });
  });

  return app;
}

function serializarTransferencia(t: TransferenciaConsultada): Record<string, unknown> {
  return {
    id: t.id,
    itemId: t.itemId,
    institutionOrigemId: t.institutionOrigemId.toString(),
    institutionDestinoId: t.institutionDestinoId.toString(),
    hashLacre: t.hashLacre,
    estado: t.estado,
    ressalva: t.ressalva,
    timestampInicio: t.timestampInicio,
    timestampConfirmacao: t.timestampConfirmacao,
  };
}

function dominioSerializavel(dominio: { name: string; version: string; chainId: bigint; verifyingContract: string }) {
  return { ...dominio, chainId: dominio.chainId.toString() };
}

function valorSerializavel<T extends Record<string, unknown>>(valor: T): Record<string, unknown> {
  const resultado: Record<string, unknown> = {};
  for (const [chave, v] of Object.entries(valor)) {
    resultado[chave] = typeof v === "bigint" ? v.toString() : v;
  }
  return resultado;
}
