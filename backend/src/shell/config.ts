import * as dotenv from "dotenv";

dotenv.config();

export const configuracao = {
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
  chavePrivadaRelayer: process.env.PRIVATE_KEY_RELAYER || "",
  rede: process.env.REDE || "localhost",
  porta: Number(process.env.PORTA) || 3333,
};
