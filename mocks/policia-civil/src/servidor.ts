/**
 * Mock Sistema da Polícia Civil — esquema deliberadamente policial.
 * Campos, taxonomia e unidades de medida distintos do Sisbemjud
 * (ex.: peso em kg vs gramas; BO vs número de processo).
 */
import Fastify from "fastify";
import cors from "@fastify/cors";

export type ApreensaoPoliciaCivil = {
  boletimOcorrencia: string;
  numeroLacre: string;
  dataApreensao: string;
  delegaciaResponsavel: string;
  enderecoBlockchain: string;
  descricaoObjeto: string;
  pesoEstimadoKg: number;
  statusApreensao: "APREENDIDO" | "REMETIDO_PERICIA" | "REMETIDO_DEPOSITO" | "BAIXADO";
  hashItemCadeia: string;
};

const PORTA = Number(process.env.PORTA) || 4002;

const apreensoes: ApreensaoPoliciaCivil[] = [
  {
    boletimOcorrencia: "BO-2026-004812",
    numeroLacre: "PC-PB-77201",
    dataApreensao: "10/03/2026",
    delegaciaResponsavel: "Delegacia de Repressão a Entorpecentes — Campina Grande",
    enderecoBlockchain: "0x5f0ad5D7c0F067F52651ec16fcE0155bB18C392e",
    descricaoObjeto: "Pistola calibre .40 com numeração raspada",
    pesoEstimadoKg: 1.25,
    statusApreensao: "REMETIDO_DEPOSITO",
    hashItemCadeia:
      "0x8f3c2a1b9d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcd",
  },
  {
    boletimOcorrencia: "BO-2026-001103",
    numeroLacre: "PC-PB-55019",
    dataApreensao: "2026-02-14",
    delegaciaResponsavel: "1ª Delegacia Distrital — João Pessoa",
    enderecoBlockchain: "0x5f0ad5D7c0F067F52651ec16fcE0155bB18C392e",
    descricaoObjeto: "Pacotes de entorpecente apreendidos em abordagem",
    pesoEstimadoKg: 4.82,
    statusApreensao: "REMETIDO_PERICIA",
    hashItemCadeia:
      "0xa1b2c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef01",
  },
];

async function main() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ system: "PoliciaCivilPB", ok: true }));

  app.get("/apreensoes", async () => ({
    sistema: "Sistema da Polícia Civil — PB",
    esquema: "boletimOcorrencia / numeroLacre / dataApreensao / delegaciaResponsavel",
    quantidade: apreensoes.length,
    apreensoes,
  }));

  app.get("/apreensoes/bo/:boletimOcorrencia", async (req, reply) => {
    const { boletimOcorrencia } = req.params as { boletimOcorrencia: string };
    const registro = apreensoes.find(
      (a) => a.boletimOcorrencia === decodeURIComponent(boletimOcorrencia),
    );
    if (!registro) return reply.code(404).send({ erro: "BO não encontrado" });
    return registro;
  });

  app.get("/apreensoes/lacre/:numeroLacre", async (req, reply) => {
    const { numeroLacre } = req.params as { numeroLacre: string };
    const registro = apreensoes.find(
      (a) => a.numeroLacre === decodeURIComponent(numeroLacre),
    );
    if (!registro) return reply.code(404).send({ erro: "Lacre policial não encontrado" });
    return registro;
  });

  app.get("/apreensoes/hash/:hashItemCadeia", async (req, reply) => {
    const { hashItemCadeia } = req.params as { hashItemCadeia: string };
    const registro = apreensoes.find(
      (a) => a.hashItemCadeia.toLowerCase() === hashItemCadeia.toLowerCase(),
    );
    if (!registro) return reply.code(404).send({ erro: "Hash não encontrado na Polícia Civil" });
    return registro;
  });

  await app.listen({ port: PORTA, host: "0.0.0.0" });
  console.log(`Mock Polícia Civil em http://127.0.0.1:${PORTA}`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
