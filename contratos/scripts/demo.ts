import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Script de demonstração para apresentação em sala.
 * Fluxo: cadastrar instituições (Polícia com multisig 2-de-3) → registrar item →
 * iniciar (assinado pela origem) → confirmar sem ressalva, confirmar com ressalva e recusar.
 *
 * Uso: npx hardhat run scripts/demo.ts
 */

const TYPES = {
  IniciarTransferencia: [
    { name: "itemId", type: "bytes32" },
    { name: "institutionOrigemId", type: "uint256" },
    { name: "institutionDestinoId", type: "uint256" },
    { name: "hashLacre", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
  ConfirmarTransferencia: [
    { name: "transferenciaId", type: "uint256" },
    { name: "hashRessalva", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
  RecusarTransferencia: [
    { name: "transferenciaId", type: "uint256" },
    { name: "hashMotivo", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
};

async function assinarOrdenado(
  dominio: { name: string; version: string; chainId: bigint; verifyingContract: string },
  signatarios: HardhatEthersSigner[],
  tipo: keyof typeof TYPES,
  valor: Record<string, unknown>,
) {
  const ordenados = [...signatarios].sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1));
  return Promise.all(ordenados.map((s) => s.signTypedData(dominio, { [tipo]: TYPES[tipo] }, valor)));
}

async function main() {
  const [owner, policiaA, policiaB, policiaC, pericia, deposito] = await ethers.getSigners();

  console.log("=== Vinculum Custodiae — Demo de Transferência ===\n");
  console.log("Contas simuladas:");
  console.log(`  Owner (TJPB):        ${owner.address}`);
  console.log(`  Polícia — signatário A: ${policiaA.address}`);
  console.log(`  Polícia — signatário B: ${policiaB.address}`);
  console.log(`  Polícia — signatário C: ${policiaC.address}`);
  console.log(`  Perícia:              ${pericia.address}`);
  console.log(`  Depósito:             ${deposito.address}\n`);

  const Fabrica = await ethers.getContractFactory("TransferenciaCustodia");
  const contrato = await Fabrica.deploy(owner.address);
  await contrato.waitForDeployment();
  const endereco = await contrato.getAddress();
  console.log(`Contrato implantado em: ${endereco} (owner: ${owner.address})\n`);

  const rede = await ethers.provider.getNetwork();
  const dominio = {
    name: "TransferenciaCustodia",
    version: "1",
    chainId: rede.chainId,
    verifyingContract: endereco,
  };

  console.log("1. Owner cadastra instituições...");
  const idPolicia = 1n; // 1a instituicao cadastrada
  const idPericia = 2n;
  const idDeposito = 3n;
  await (await contrato.cadastrarInstituicao("POLICIA", 2)).wait(); // threshold 2-de-3
  await (await contrato.cadastrarInstituicao("PERICIA", 1)).wait();
  await (await contrato.cadastrarInstituicao("DEPOSITO", 1)).wait();
  await (await contrato.adicionarSignatario(idPolicia, policiaA.address)).wait();
  await (await contrato.adicionarSignatario(idPolicia, policiaB.address)).wait();
  await (await contrato.adicionarSignatario(idPolicia, policiaC.address)).wait();
  await (await contrato.adicionarSignatario(idPericia, pericia.address)).wait();
  await (await contrato.adicionarSignatario(idDeposito, deposito.address)).wait();
  console.log("   ✓ Polícia (threshold 2-de-3), Perícia e Depósito (threshold 1) cadastrados\n");

  const itemId = ethers.keccak256(ethers.toUtf8Bytes("policia-civil:apreensao-2024-000042"));
  console.log("2. Polícia registra a custódia inicial do item...");
  await (await contrato.connect(policiaA).registrarItem(idPolicia, itemId)).wait();
  console.log(`   Item (hash único): ${itemId}\n`);

  const numeroLacre = "LP-2233-QR";
  const hashLacre = ethers.keccak256(ethers.toUtf8Bytes(numeroLacre));
  console.log(`3. Lacre físico do transporte: ${numeroLacre}`);
  console.log(`   Hash on-chain: ${hashLacre}\n`);

  console.log("4. Polícia inicia transferência para Perícia (2 de 3 signatários assinam)...");
  const assinaturasIniciar = await assinarOrdenado(dominio, [policiaA, policiaB], "IniciarTransferencia", {
    itemId,
    institutionOrigemId: idPolicia,
    institutionDestinoId: idPericia,
    hashLacre,
    nonce: 0n,
  });
  const txInicio = await contrato.connect(policiaA).iniciar(itemId, idPericia, hashLacre, assinaturasIniciar);
  const reciboInicio = await txInicio.wait();
  console.log(`   TX: ${reciboInicio?.hash}`);
  console.log(`   Estado: Iniciada | custódia ainda com Polícia até a contra-assinatura\n`);

  console.log("5. Perícia confirma recebimento sem ressalva...");
  const assinaturasConfirmar = await assinarOrdenado(dominio, [pericia], "ConfirmarTransferencia", {
    transferenciaId: 1n,
    hashRessalva: ethers.keccak256(ethers.toUtf8Bytes("")),
    nonce: 0n,
  });
  await (await contrato.connect(pericia).confirmar(1n, "", assinaturasConfirmar)).wait();
  console.log(`   Custodiante atual (institutionId): ${await contrato.custodianteInstituicaoAtual(itemId)}\n`);

  console.log("6. Perícia inicia transferência para Depósito...");
  const outroLacre = ethers.keccak256(ethers.toUtf8Bytes("LP-2234-QR"));
  const assinaturasIniciar2 = await assinarOrdenado(dominio, [pericia], "IniciarTransferencia", {
    itemId,
    institutionOrigemId: idPericia,
    institutionDestinoId: idDeposito,
    hashLacre: outroLacre,
    nonce: 1n, // periciaId ja consumiu nonce 0 ao confirmar a transferencia anterior
  });
  await (await contrato.connect(pericia).iniciar(itemId, idDeposito, outroLacre, assinaturasIniciar2)).wait();

  console.log("7. Depósito RECUSA (lacre chegou rompido)...");
  const motivo = "lacre secundario violado, peso divergente em 0.3kg";
  const assinaturasRecusar = await assinarOrdenado(dominio, [deposito], "RecusarTransferencia", {
    transferenciaId: 2n,
    hashMotivo: ethers.keccak256(ethers.toUtf8Bytes(motivo)),
    nonce: 0n,
  });
  await (await contrato.connect(deposito).recusar(2n, motivo, assinaturasRecusar)).wait();

  const t1 = await contrato.connect(policiaA).consultar(1n);
  const t2 = await contrato.connect(policiaA).consultar(2n);
  const historico = await contrato.connect(policiaA).consultarHistoricoItem(itemId);

  console.log("\n=== Estado final on-chain ===");
  console.log(`Custodiante atual (institutionId): ${await contrato.custodianteInstituicaoAtual(itemId)} (permanece com Perícia — recusa não transfere)`);
  console.log(`Histórico de transferências do item: [${historico.join(", ")}]`);
  console.log(`\nTransferência #1: Polícia → Perícia | estado=${t1.estado} (Confirmada)`);
  console.log(`Transferência #2: Perícia → Depósito | estado=${t2.estado} (Recusada)`);
  console.log(`Motivo da recusa: "${t2.ressalva}"`);
  console.log("\n✓ Demo concluída. Cadeia de custódia registrada na blockchain.");
}

main()
  .then(() => process.exit(0))
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
