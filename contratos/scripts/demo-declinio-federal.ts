import { ethers } from "hardhat";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Cenário exigido pela especificação do Projeto 5:
 * declínio de competência da Justiça Estadual para a Federal.
 * O juízo federal verifica toda a cadeia de custódia pretérita
 * sem solicitar nada ao tribunal estadual.
 *
 * Uso: npx hardhat run scripts/demo-declinio-federal.ts
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
};

async function assinarOrdenado(
  dominio: { name: string; version: string; chainId: bigint; verifyingContract: string },
  signatarios: HardhatEthersSigner[],
  tipo: keyof typeof TYPES,
  valor: Record<string, unknown>,
) {
  const ordenados = [...signatarios].sort((a, b) =>
    a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1,
  );
  return Promise.all(ordenados.map((s) => s.signTypedData(dominio, { [tipo]: TYPES[tipo] }, valor)));
}

async function main() {
  const [owner, policia, pericia, justEstadual, justFederal] = await ethers.getSigners();

  console.log("=== Demo — Declínio de competência Estadual → Federal ===\n");
  console.log(`  Polícia Civil:     ${policia.address}`);
  console.log(`  Perícia:           ${pericia.address}`);
  console.log(`  Justiça Estadual:  ${justEstadual.address}`);
  console.log(`  Justiça Federal:   ${justFederal.address}\n`);

  const Fabrica = await ethers.getContractFactory("TransferenciaCustodia");
  const contrato = await Fabrica.deploy(owner.address);
  await contrato.waitForDeployment();
  const endereco = await contrato.getAddress();

  const rede = await ethers.provider.getNetwork();
  const dominio = {
    name: "TransferenciaCustodia",
    version: "1",
    chainId: rede.chainId,
    verifyingContract: endereco,
  };

  const idPolicia = 1n;
  const idPericia = 2n;
  const idEstadual = 3n;
  const idFederal = 4n;

  await (await contrato.cadastrarInstituicao("POLICIA-CIVIL", 1)).wait();
  await (await contrato.cadastrarInstituicao("PERICIA", 1)).wait();
  await (await contrato.cadastrarInstituicao("JUSTICA-ESTADUAL", 1)).wait();
  await (await contrato.cadastrarInstituicao("JUSTICA-FEDERAL", 1)).wait();
  await (await contrato.adicionarSignatario(idPolicia, policia.address)).wait();
  await (await contrato.adicionarSignatario(idPericia, pericia.address)).wait();
  await (await contrato.adicionarSignatario(idEstadual, justEstadual.address)).wait();
  await (await contrato.adicionarSignatario(idFederal, justFederal.address)).wait();
  console.log("1. Instituições cadastradas (incluindo Justiça Federal)\n");

  const itemId = ethers.keccak256(ethers.toUtf8Bytes("declinio:bo-2026-federal-001"));
  await (await contrato.connect(policia).registrarItem(idPolicia, itemId)).wait();
  console.log(`2. Bem apreendido registrado pela Polícia Civil\n   itemId=${itemId}\n`);

  async function transferir(
    de: HardhatEthersSigner,
    origemId: bigint,
    destinoId: bigint,
    lacre: string,
    transferenciaId: bigint,
    nonceOrigem: bigint,
    nonceDestino: bigint,
    ressalva: string,
  ) {
    const hashLacre = ethers.keccak256(ethers.toUtf8Bytes(lacre));
    const assinaturasIniciar = await assinarOrdenado(dominio, [de], "IniciarTransferencia", {
      itemId,
      institutionOrigemId: origemId,
      institutionDestinoId: destinoId,
      hashLacre,
      nonce: nonceOrigem,
    });
    await (await contrato.connect(de).iniciar(itemId, destinoId, hashLacre, assinaturasIniciar)).wait();

    const destino =
      destinoId === idPericia ? pericia : destinoId === idEstadual ? justEstadual : justFederal;
    const assinaturasConfirmar = await assinarOrdenado(dominio, [destino], "ConfirmarTransferencia", {
      transferenciaId,
      hashRessalva: ethers.keccak256(ethers.toUtf8Bytes(ressalva)),
      nonce: nonceDestino,
    });
    await (await contrato.connect(destino).confirmar(transferenciaId, ressalva, assinaturasConfirmar)).wait();
  }

  console.log("3. Cadeia estadual: Polícia → Perícia → Justiça Estadual");
  await transferir(policia, idPolicia, idPericia, "LACRE-PC-001", 1n, 0n, 0n, "");
  await transferir(
    pericia,
    idPericia,
    idEstadual,
    "LACRE-PE-002",
    2n,
    1n,
    0n,
    "[Divergência de peso] peso aferido 0.2kg abaixo do BO",
  );
  console.log("   ✓ Custódia estadual completa (com ressalva na 2ª transferência)\n");

  console.log("4. Declínio de competência: Justiça Estadual → Justiça Federal");
  await transferir(justEstadual, idEstadual, idFederal, "LACRE-JE-003", 3n, 1n, 0n, "");
  console.log("   ✓ Custódia agora com a Justiça Federal\n");

  console.log("5. Juízo federal consulta a cadeia pretérita (sem pedir nada ao tribunal estadual)...");
  const historico = await contrato.connect(justFederal).consultarHistoricoItem(itemId);
  console.log(`   IDs de transferência: [${historico.join(", ")}]`);

  for (const id of historico) {
    const t = await contrato.connect(justFederal).consultar(id);
    const estados = ["Iniciada", "Confirmada", "ConfirmadaComRessalva", "Recusada"];
    console.log(
      `   #${id}: origem=${t.institutionOrigemId} → destino=${t.institutionDestinoId} | ${estados[Number(t.estado)]}${
        t.ressalva ? ` | ressalva="${t.ressalva}"` : ""
      }`,
    );
  }

  const custodiante = await contrato.custodianteInstituicaoAtual(itemId);
  console.log(`\nCustodiante atual: instituição ${custodiante} (JUSTICA-FEDERAL)`);
  console.log(
    "\n✓ O juízo federal leu toda a cadeia pretérita diretamente na blockchain —",
  );
  console.log("  nenhuma solicitação ao tribunal estadual foi necessária.");
}

main()
  .then(() => process.exit(0))
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
