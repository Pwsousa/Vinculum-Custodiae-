import { ethers } from "hardhat";

/**
 * Script de demonstração para apresentação em sala.
 * Executa o fluxo completo: autorizar → iniciar → confirmar (com e sem ressalva).
 *
 * Uso: npx hardhat run scripts/demo.ts
 */
async function main() {
  const [owner, policia, pericia, deposito] = await ethers.getSigners();

  console.log("=== Vinculum Custodiae — Demo de Transferência ===\n");
  console.log("Contas simuladas:");
  console.log(`  Owner (TJPB):  ${owner.address}`);
  console.log(`  Polícia Civil: ${policia.address}`);
  console.log(`  Perícia:       ${pericia.address}`);
  console.log(`  Depósito:      ${deposito.address}\n`);

  const Fabrica = await ethers.getContractFactory("TransferenciaCustodia");
  const contrato = await Fabrica.deploy();
  await contrato.waitForDeployment();
  const endereco = await contrato.getAddress();
  console.log(`Contrato implantado em: ${endereco}\n`);

  // Autorizar instituições
  console.log("1. Owner autoriza instituições...");
  await (await contrato.autorizarInstituicao(policia.address)).wait();
  await (await contrato.autorizarInstituicao(pericia.address)).wait();
  await (await contrato.autorizarInstituicao(deposito.address)).wait();
  console.log("   ✓ Polícia, Perícia e Depósito autorizados\n");

  const numeroLacre = "LP-2233-QR";
  const hashLacre = ethers.keccak256(ethers.toUtf8Bytes(numeroLacre));
  console.log(`2. Lacre físico: ${numeroLacre}`);
  console.log(`   Hash on-chain: ${hashLacre}\n`);

  // Transferência 1: Polícia → Perícia (sem ressalva)
  console.log("3. Polícia inicia transferência para Perícia (1ª assinatura)...");
  const txInicio = await contrato.connect(policia).iniciar(pericia.address, hashLacre);
  const reciboInicio = await txInicio.wait();
  console.log(`   TX: ${reciboInicio?.hash}`);
  console.log(`   Estado: Iniciada | Custodiante atual: ${await contrato.custodianteAtual(hashLacre) || "(ainda não confirmado)"}\n`);

  console.log("4. Perícia confirma recebimento (2ª assinatura)...");
  const txConfirma = await contrato.connect(pericia).confirmar(0n, "");
  const reciboConfirma = await txConfirma.wait();
  console.log(`   TX: ${reciboConfirma?.hash}`);
  console.log(`   Custodiante atual: ${await contrato.custodianteAtual(hashLacre)}\n`);

  // Transferência 2: Perícia → Depósito (com ressalva)
  console.log("5. Perícia inicia transferência para Depósito...");
  await (await contrato.connect(pericia).iniciar(deposito.address, hashLacre)).wait();

  console.log("6. Depósito confirma COM RESSALVA (lacre secundário violado)...");
  const ressalva = "lacre secundario violado, peso divergente em 0.3kg";
  await (await contrato.connect(deposito).confirmar(1n, ressalva)).wait();

  const t1 = await contrato.connect(deposito).consultar(0n);
  const t2 = await contrato.connect(deposito).consultar(1n);
  const historico = await contrato.connect(deposito).consultarHistorico(hashLacre);

  console.log("\n=== Estado final on-chain ===");
  console.log(`Custodiante atual: ${await contrato.custodianteAtual(hashLacre)}`);
  console.log(`Histórico de transferências: [${historico.join(", ")}]`);
  console.log(`\nTransferência #0: ${t1.instituicaoOrigem.slice(0, 10)}... → ${t1.instituicaoDestino.slice(0, 10)}... | estado=${t1.estado} (Confirmada)`);
  console.log(`Transferência #1: ${t2.instituicaoOrigem.slice(0, 10)}... → ${t2.instituicaoDestino.slice(0, 10)}... | estado=${t2.estado} (ConfirmadaComRessalva)`);
  console.log(`Ressalva: "${t2.ressalva}"`);
  console.log("\n✓ Demo concluída. Cadeia de custódia registrada na blockchain.");
}

main()
  .then(() => process.exit(0))
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
