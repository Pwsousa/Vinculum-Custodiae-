import { expect } from "chai";
import { ethers } from "hardhat";
import { TransferenciaCustodia } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

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

describe("TransferenciaCustodia", () => {
  let contrato: TransferenciaCustodia;
  let owner: SignerWithAddress;
  let policiaA: SignerWithAddress;
  let policiaB: SignerWithAddress;
  let policiaC: SignerWithAddress;
  let pericia: SignerWithAddress;
  let deposito: SignerWithAddress;
  let terceiro: SignerWithAddress;

  let policiaId: bigint;
  let periciaId: bigint;
  let depositoId: bigint;

  let dominio: { name: string; version: string; chainId: bigint; verifyingContract: string };

  const itemId = ethers.keccak256(ethers.toUtf8Bytes("policia-civil:bem-000042"));
  const hashLacre = ethers.keccak256(ethers.toUtf8Bytes("lacre-qr-001"));

  async function assinarOrdenado(
    signatarios: SignerWithAddress[],
    tipo: keyof typeof TYPES,
    valor: Record<string, unknown>,
  ): Promise<string[]> {
    const ordenados = [...signatarios].sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1));
    return Promise.all(
      ordenados.map((s) => s.signTypedData(dominio, { [tipo]: TYPES[tipo] }, valor)),
    );
  }

  beforeEach(async () => {
    [owner, policiaA, policiaB, policiaC, pericia, deposito, terceiro] = await ethers.getSigners();
    const Fabrica = await ethers.getContractFactory("TransferenciaCustodia");
    contrato = await Fabrica.deploy(owner.address);
    await contrato.waitForDeployment();

    const rede = await ethers.provider.getNetwork();
    dominio = {
      name: "TransferenciaCustodia",
      version: "1",
      chainId: rede.chainId,
      verifyingContract: await contrato.getAddress(),
    };

    // Polícia Civil: threshold 2-de-3
    const txPolicia = await contrato.cadastrarInstituicao("POLICIA", 2);
    policiaId = await extrairInstitutionId(txPolicia);
    await contrato.adicionarSignatario(policiaId, policiaA.address);
    await contrato.adicionarSignatario(policiaId, policiaB.address);
    await contrato.adicionarSignatario(policiaId, policiaC.address);

    // Perícia e Depósito: threshold 1 (fluxo simples)
    const txPericia = await contrato.cadastrarInstituicao("PERICIA", 1);
    periciaId = await extrairInstitutionId(txPericia);
    await contrato.adicionarSignatario(periciaId, pericia.address);

    const txDeposito = await contrato.cadastrarInstituicao("DEPOSITO", 1);
    depositoId = await extrairInstitutionId(txDeposito);
    await contrato.adicionarSignatario(depositoId, deposito.address);

    await contrato.connect(policiaA).registrarItem(policiaId, itemId);
  });

  async function extrairInstitutionId(tx: Awaited<ReturnType<typeof contrato.cadastrarInstituicao>>) {
    const recibo = await tx.wait();
    const evento = recibo!.logs
      .map((l) => contrato.interface.parseLog(l))
      .find((l) => l?.name === "InstituicaoCadastrada");
    return evento!.args.institutionId as bigint;
  }

  describe("administração de instituições", () => {
    it("apenas owner cadastra instituicao", async () => {
      await expect(
        contrato.connect(terceiro).cadastrarInstituicao("X", 1),
      ).to.be.revertedWith("apenas owner");
    });

    it("apenas owner adiciona signatario", async () => {
      await expect(
        contrato.connect(terceiro).adicionarSignatario(policiaId, terceiro.address),
      ).to.be.revertedWith("apenas owner");
    });

    it("nao deixa remover signatario abaixo do threshold", async () => {
      await contrato.removerSignatario(policiaId, policiaC.address);
      await expect(
        contrato.removerSignatario(policiaId, policiaB.address),
      ).to.be.revertedWith("removeria abaixo do threshold");
    });

    it("altera threshold dentro do numero de signatarios existentes", async () => {
      await contrato.alterarThreshold(policiaId, 3);
      await expect(contrato.alterarThreshold(policiaId, 4)).to.be.revertedWith("threshold invalido");
    });

    it("desativa instituicao e bloqueia iniciar subsequente", async () => {
      await contrato.desativarInstituicao(periciaId);
      const assinaturas = await assinarOrdenado([policiaA, policiaB], "IniciarTransferencia", {
        itemId,
        institutionOrigemId: policiaId,
        institutionDestinoId: periciaId,
        hashLacre,
        nonce: 0n,
      });
      await expect(
        contrato.connect(policiaA).iniciar(itemId, periciaId, hashLacre, assinaturas),
      ).to.be.revertedWith("destino nao autorizado");
    });

    it("transfere ownership em duas etapas", async () => {
      await contrato.transferirOwnership(terceiro.address);
      await expect(contrato.connect(policiaA).aceitarOwnership()).to.be.revertedWith(
        "apenas owner pendente",
      );
      await contrato.connect(terceiro).aceitarOwnership();
      expect(await contrato.owner()).to.equal(terceiro.address);
    });
  });

  describe("registrarItem", () => {
    it("apenas signatario da instituicao registra item", async () => {
      const novoItem = ethers.keccak256(ethers.toUtf8Bytes("bem-999"));
      await expect(
        contrato.connect(terceiro).registrarItem(policiaId, novoItem),
      ).to.be.revertedWith("nao e signatario da instituicao");
    });

    it("nao deixa registrar o mesmo item duas vezes", async () => {
      await expect(
        contrato.connect(policiaA).registrarItem(policiaId, itemId),
      ).to.be.revertedWith("item ja registrado");
    });
  });

  describe("iniciar (multisig da origem)", () => {
    it("nao deixa iniciar com menos assinaturas que o threshold", async () => {
      const assinaturas = await assinarOrdenado([policiaA], "IniciarTransferencia", {
        itemId,
        institutionOrigemId: policiaId,
        institutionDestinoId: periciaId,
        hashLacre,
        nonce: 0n,
      });
      await expect(
        contrato.connect(policiaA).iniciar(itemId, periciaId, hashLacre, assinaturas),
      ).to.be.revertedWithCustomError(contrato, "AssinaturasInsuficientes");
    });

    it("nao deixa assinatura de quem nao e signatario da instituicao", async () => {
      const assinaturas = await assinarOrdenado([policiaA, terceiro], "IniciarTransferencia", {
        itemId,
        institutionOrigemId: policiaId,
        institutionDestinoId: periciaId,
        hashLacre,
        nonce: 0n,
      });
      await expect(
        contrato.connect(policiaA).iniciar(itemId, periciaId, hashLacre, assinaturas),
      ).to.be.revertedWithCustomError(contrato, "AssinanteNaoAutorizado");
    });

    it("nao deixa assinatura duplicada ou fora de ordem", async () => {
      const assinaturas = await assinarOrdenado([policiaA, policiaB], "IniciarTransferencia", {
        itemId,
        institutionOrigemId: policiaId,
        institutionDestinoId: periciaId,
        hashLacre,
        nonce: 0n,
      });
      const foraDeOrdem = [...assinaturas].reverse();
      await expect(
        contrato.connect(policiaA).iniciar(itemId, periciaId, hashLacre, foraDeOrdem),
      ).to.be.revertedWithCustomError(contrato, "AssinaturaForaDeOrdem");
    });

    it("inicia transferencia com threshold de assinaturas atingido", async () => {
      const assinaturas = await assinarOrdenado([policiaA, policiaB], "IniciarTransferencia", {
        itemId,
        institutionOrigemId: policiaId,
        institutionDestinoId: periciaId,
        hashLacre,
        nonce: 0n,
      });
      const tx = await contrato.connect(policiaA).iniciar(itemId, periciaId, hashLacre, assinaturas);
      await expect(tx)
        .to.emit(contrato, "TransferenciaIniciada")
        .withArgs(1n, itemId, policiaId, periciaId, hashLacre);

      const t = await contrato.connect(policiaA).consultar(1n);
      expect(t.estado).to.equal(0n); // Iniciada
      expect(await contrato.custodianteInstituicaoAtual(itemId)).to.equal(policiaId);
    });

    it("nao deixa reusar lacre ja utilizado", async () => {
      const assinaturas1 = await assinarOrdenado([policiaA, policiaB], "IniciarTransferencia", {
        itemId,
        institutionOrigemId: policiaId,
        institutionDestinoId: periciaId,
        hashLacre,
        nonce: 0n,
      });
      await contrato.connect(policiaA).iniciar(itemId, periciaId, hashLacre, assinaturas1);
      await contrato.connect(pericia).confirmar(1n, "", await assinarOrdenado([pericia], "ConfirmarTransferencia", {
        transferenciaId: 1n,
        hashRessalva: ethers.keccak256(ethers.toUtf8Bytes("")),
        nonce: 0n,
      }));

      const novoItem = ethers.keccak256(ethers.toUtf8Bytes("policia-civil:bem-000099"));
      await contrato.connect(pericia).registrarItem(periciaId, novoItem);
      const assinaturas2 = await assinarOrdenado([pericia], "IniciarTransferencia", {
        itemId: novoItem,
        institutionOrigemId: periciaId,
        institutionDestinoId: depositoId,
        hashLacre,
        nonce: 0n,
      });
      await expect(
        contrato.connect(pericia).iniciar(novoItem, depositoId, hashLacre, assinaturas2),
      ).to.be.revertedWith("lacre ja utilizado");
    });

    it("nao deixa segunda transferencia pendente pro mesmo item", async () => {
      const assinaturas = await assinarOrdenado([policiaA, policiaB], "IniciarTransferencia", {
        itemId,
        institutionOrigemId: policiaId,
        institutionDestinoId: periciaId,
        hashLacre,
        nonce: 0n,
      });
      await contrato.connect(policiaA).iniciar(itemId, periciaId, hashLacre, assinaturas);

      const outroLacre = ethers.keccak256(ethers.toUtf8Bytes("lacre-qr-002"));
      const assinaturas2 = await assinarOrdenado([policiaA, policiaB], "IniciarTransferencia", {
        itemId,
        institutionOrigemId: policiaId,
        institutionDestinoId: depositoId,
        hashLacre: outroLacre,
        nonce: 1n,
      });
      await expect(
        contrato.connect(policiaA).iniciar(itemId, depositoId, outroLacre, assinaturas2),
      ).to.be.revertedWith("ja existe transferencia pendente");
    });
  });

  describe("confirmar / recusar (multisig do destino)", () => {
    beforeEach(async () => {
      const assinaturas = await assinarOrdenado([policiaA, policiaB], "IniciarTransferencia", {
        itemId,
        institutionOrigemId: policiaId,
        institutionDestinoId: periciaId,
        hashLacre,
        nonce: 0n,
      });
      await contrato.connect(policiaA).iniciar(itemId, periciaId, hashLacre, assinaturas);
    });

    it("confirma sem ressalva e transfere custodia", async () => {
      const assinaturas = await assinarOrdenado([pericia], "ConfirmarTransferencia", {
        transferenciaId: 1n,
        hashRessalva: ethers.keccak256(ethers.toUtf8Bytes("")),
        nonce: 0n,
      });
      await expect(contrato.connect(pericia).confirmar(1n, "", assinaturas))
        .to.emit(contrato, "TransferenciaConfirmada")
        .withArgs(1n, false, "")
        .and.to.emit(contrato, "CustodiaAlterada")
        .withArgs(itemId, periciaId);

      expect(await contrato.custodianteInstituicaoAtual(itemId)).to.equal(periciaId);
      expect(await contrato.transferenciaPendentePorItem(itemId)).to.equal(0n);
    });

    it("confirma com ressalva e vira ConfirmadaComRessalva", async () => {
      const ressalva = "caixa com avaria no lacre secundario";
      const assinaturas = await assinarOrdenado([pericia], "ConfirmarTransferencia", {
        transferenciaId: 1n,
        hashRessalva: ethers.keccak256(ethers.toUtf8Bytes(ressalva)),
        nonce: 0n,
      });
      await contrato.connect(pericia).confirmar(1n, ressalva, assinaturas);

      const t = await contrato.connect(pericia).consultar(1n);
      expect(t.estado).to.equal(2n); // ConfirmadaComRessalva
      expect(t.ressalva).to.equal(ressalva);
    });

    it("nao deixa confirmar duas vezes (nonce ja consumido)", async () => {
      const assinaturas = await assinarOrdenado([pericia], "ConfirmarTransferencia", {
        transferenciaId: 1n,
        hashRessalva: ethers.keccak256(ethers.toUtf8Bytes("")),
        nonce: 0n,
      });
      await contrato.connect(pericia).confirmar(1n, "", assinaturas);
      await expect(contrato.connect(pericia).confirmar(1n, "", assinaturas)).to.be.revertedWith(
        "estado invalido",
      );
    });

    it("recusa: custodia permanece com origem e lacre continua utilizado", async () => {
      const motivo = "lacre chegou rompido";
      const assinaturas = await assinarOrdenado([pericia], "RecusarTransferencia", {
        transferenciaId: 1n,
        hashMotivo: ethers.keccak256(ethers.toUtf8Bytes(motivo)),
        nonce: 0n,
      });
      await expect(contrato.connect(pericia).recusar(1n, motivo, assinaturas))
        .to.emit(contrato, "TransferenciaRecusada")
        .withArgs(1n, motivo);

      const t = await contrato.connect(pericia).consultar(1n);
      expect(t.estado).to.equal(3n); // Recusada
      expect(await contrato.custodianteInstituicaoAtual(itemId)).to.equal(policiaId);
      expect(await contrato.transferenciaPendentePorItem(itemId)).to.equal(0n);
      expect(await contrato.lacreUtilizado(hashLacre)).to.equal(true);
    });
  });

  describe("consulta e historico", () => {
    it("nao deixa quem nao e signatario de nenhuma instituicao consultar", async () => {
      await expect(contrato.connect(terceiro).consultar(1n)).to.be.revertedWith(
        "sem acesso de leitura",
      );
    });

    it("permite o owner (relayer) consultar sem ser signatario", async () => {
      const t = await contrato.connect(owner).consultar(1n);
      expect(t.itemId).to.equal(itemId);
    });

    it("acumula historico de transferencias por item", async () => {
      const assinaturas1 = await assinarOrdenado([policiaA, policiaB], "IniciarTransferencia", {
        itemId,
        institutionOrigemId: policiaId,
        institutionDestinoId: periciaId,
        hashLacre,
        nonce: 0n,
      });
      await contrato.connect(policiaA).iniciar(itemId, periciaId, hashLacre, assinaturas1);
      await contrato.connect(pericia).confirmar(
        1n,
        "",
        await assinarOrdenado([pericia], "ConfirmarTransferencia", {
          transferenciaId: 1n,
          hashRessalva: ethers.keccak256(ethers.toUtf8Bytes("")),
          nonce: 0n,
        }),
      );

      const outroLacre = ethers.keccak256(ethers.toUtf8Bytes("lacre-qr-002"));
      const assinaturas2 = await assinarOrdenado([pericia], "IniciarTransferencia", {
        itemId,
        institutionOrigemId: periciaId,
        institutionDestinoId: depositoId,
        hashLacre: outroLacre,
        nonce: 1n, // periciaId ja consumiu nonce 0 ao confirmar a 1a transferencia
      });
      await contrato.connect(pericia).iniciar(itemId, depositoId, outroLacre, assinaturas2);

      const historico = await contrato.connect(policiaA).consultarHistoricoItem(itemId);
      expect(historico).to.deep.equal([1n, 2n]);
    });
  });
});
