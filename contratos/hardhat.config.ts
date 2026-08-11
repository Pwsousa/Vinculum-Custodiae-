import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const PRIVATE_KEY_DEPLOY = process.env.PRIVATE_KEY_DEPLOY || "";

// Rede Besu da disciplina (github.com/ccufcg/bc101-dev-env). Chain id e contas vem do
// genesis.json do próprio repo — chaves públicas de dev, não são segredo.
const BESU_RPC_URL = process.env.BESU_RPC_URL || "http://127.0.0.1:8545";
const CONTAS_BESU_GENESIS = [
  "0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63",
  "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3",
  "0xae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f",
];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      // A rede Besu da disciplina só ativa ate o fork Berlin (sem London/Shanghai/Cancun) —
      // bytecode com opcodes mais novos (ex: PUSH0, MCOPY) nao roda la.
      evmVersion: "berlin",
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    besu: {
      url: BESU_RPC_URL,
      chainId: 1337,
      accounts: CONTAS_BESU_GENESIS,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY_DEPLOY ? [PRIVATE_KEY_DEPLOY] : [],
    },
  },
};

export default config;
