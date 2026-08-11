/**
 * Mock Sisbemjud — esquema deliberadamente judicial.
 * Taxonomia e nomes de campo distintos do mock da Polícia Civil.
 * A blockchain NÃO armazena estes campos: só o evento de custódia.
 */
import Fastify from "fastify";
import cors from "@fastify/cors";

export type BemSisbemjud = {
  numeroProcesso: string;
  numeroLacreJudicial: string;
  dataDeposito: string;
  varaResponsavel: string;
  enderecoBlockchain: string;
  naturezaBem: string;
  pesoDeclaradoGramas: number;
  situacaoCustodia: "DEPOSITADO" | "EM_TRANSITO" | "LEILAO" | "RESTITUIDO";
  itemIdBlockchain: string;
};

const PORTA = Number(process.env.PORTA) || 4001;

const bens: BemSisbemjud[] = [
  {
    numeroProcesso: "0001234-56.2026.8.15.2001",
    numeroLacreJudicial: "LJ-88421-TJPB",
    dataDeposito: "2026-03-12",
    varaResponsavel: "2ª Vara Criminal da Comarca de Campina Grande",
    enderecoBlockchain: "0x5f0ad5D7c0F067F52651ec16fcE0155bB18C392e",
    naturezaBem: "ARMA_FOGO",
    pesoDeclaradoGramas: 1250,
    situacaoCustodia: "DEPOSITADO",
    itemIdBlockchain:
      "0x8f3c2a1b9d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcd",
  },
  {
    numeroProcesso: "0009876-11.2026.8.15.0001",
    numeroLacreJudicial: "LJ-99102-TJPB",
    dataDeposito: "15/02/2026",
    varaResponsavel: "1ª Vara Federal Criminal — Seção Judiciária da PB (espelho local)",
    enderecoBlockchain: "0x5f0ad5D7c0F067F52651ec16fcE0155bB18C392e",
    naturezaBem: "ENTORPECENTE",
    pesoDeclaradoGramas: 4820,
    situacaoCustodia: "EM_TRANSITO",
    itemIdBlockchain:
      "0xa1b2c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef01",
  },
];

async function main() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get("/saude", async () => ({ sistema: "Sisbemjud", status: "ok" }));

  app.get("/bens", async () => ({
    sistema: "Sisbemjud",
    esquema: "numeroProcesso / numeroLacreJudicial / dataDeposito / varaResponsavel",
    total: bens.length,
    bens,
  }));

  app.get("/bens/por-processo/:numeroProcesso", async (req, reply) => {
    const { numeroProcesso } = req.params as { numeroProcesso: string };
    const bem = bens.find((b) => b.numeroProcesso === decodeURIComponent(numeroProcesso));
    if (!bem) return reply.code(404).send({ erro: "Processo não encontrado no Sisbemjud" });
    return bem;
  });

  app.get("/bens/por-lacre/:numeroLacreJudicial", async (req, reply) => {
    const { numeroLacreJudicial } = req.params as { numeroLacreJudicial: string };
    const bem = bens.find((b) => b.numeroLacreJudicial === decodeURIComponent(numeroLacreJudicial));
    if (!bem) return reply.code(404).send({ erro: "Lacre judicial não encontrado" });
    return bem;
  });

  app.get("/bens/por-item/:itemIdBlockchain", async (req, reply) => {
    const { itemIdBlockchain } = req.params as { itemIdBlockchain: string };
    const bem = bens.find(
      (b) => b.itemIdBlockchain.toLowerCase() === itemIdBlockchain.toLowerCase(),
    );
    if (!bem) return reply.code(404).send({ erro: "Item blockchain não espelhado no Sisbemjud" });
    return bem;
  });

  await app.listen({ port: PORTA, host: "0.0.0.0" });
  console.log(`Mock Sisbemjud em http://127.0.0.1:${PORTA}`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
