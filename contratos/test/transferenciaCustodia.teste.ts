import { expect } from "chai";
import { ethers } from "hardhat";
import { TransferenciaCustodia } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("TransferenciaCustodia", () => {
  let contrato: TransferenciaCustodia;
  let owner: SignerWithAddress;
  let origem: SignerWithAddress;
  let destino: SignerWithAddress;
  let terceiro: SignerWithAddress;
  const hashLacre = ethers.keccak256(ethers.toUtf8Bytes("lacre-qr-001"));

  beforeEach(async () => {
    [owner, origem, destino, terceiro] = await ethers.getSigners();
    const Fabrica = await ethers.getContractFactory("TransferenciaCustodia");
    contrato = await Fabrica.deploy();
    await contrato.autorizarInstituicao(origem.address);
    await contrato.autorizarInstituicao(destino.address);
  });

  it("nao deixa instituicao nao autorizada iniciar transferencia", async () => {
    await expect(
      contrato.connect(terceiro).iniciar(destino.address, hashLacre)
    ).to.be.revertedWith("instituicao nao autorizada");
  });

  it("nao deixa iniciar transferencia pra destino nao autorizado", async () => {
    await expect(
      contrato.connect(origem).iniciar(terceiro.address, hashLacre)
    ).to.be.revertedWith("destino nao autorizado");
  });

  it("inicia e confirma transferencia sem ressalva", async () => {
    const tx = await contrato.connect(origem).iniciar(destino.address, hashLacre);
    const id = 0n;

    await expect(tx)
      .to.emit(contrato, "TransferenciaIniciada")
      .withArgs(id, origem.address, destino.address, hashLacre);

    await expect(contrato.connect(destino).confirmar(id, ""))
      .to.emit(contrato, "TransferenciaConfirmada")
      .withArgs(id, false, "");

    const transferencia = await contrato.connect(destino).consultar(id);
    expect(transferencia.estado).to.equal(1n); // Confirmada
  });

  it("confirma com ressalva e vira estado ConfirmadaComRessalva (nao excecao)", async () => {
    await contrato.connect(origem).iniciar(destino.address, hashLacre);
    const id = 0n;

    await contrato.connect(destino).confirmar(id, "caixa com avaria no lacre secundario");

    const transferencia = await contrato.connect(destino).consultar(id);
    expect(transferencia.estado).to.equal(2n); // ConfirmadaComRessalva
    expect(transferencia.ressalva).to.equal("caixa com avaria no lacre secundario");
  });

  it("nao deixa quem nao e o destino confirmar", async () => {
    await contrato.connect(origem).iniciar(destino.address, hashLacre);
    const id = 0n;

    await expect(
      contrato.connect(origem).confirmar(id, "")
    ).to.be.revertedWith("apenas destino confirma");
  });

  it("nao deixa confirmar transferencia ja confirmada (estado nao volta pra Iniciada)", async () => {
    await contrato.connect(origem).iniciar(destino.address, hashLacre);
    const id = 0n;
    await contrato.connect(destino).confirmar(id, "");

    await expect(
      contrato.connect(destino).confirmar(id, "tentativa dupla")
    ).to.be.revertedWith("estado invalido");
  });

  it("nao deixa instituicao nao autorizada consultar transferencia", async () => {
    await contrato.connect(origem).iniciar(destino.address, hashLacre);
    const id = 0n;

    await expect(
      contrato.connect(terceiro).consultar(id)
    ).to.be.revertedWith("instituicao nao autorizada");
  });

  it("incrementa id sequencialmente entre transferencias distintas", async () => {
    await contrato.connect(origem).iniciar(destino.address, hashLacre);
    await contrato.connect(origem).iniciar(destino.address, hashLacre);

    const primeira = await contrato.connect(origem).consultar(0n);
    const segunda = await contrato.connect(origem).consultar(1n);

    expect(primeira.instituicaoOrigem).to.equal(origem.address);
    expect(segunda.instituicaoOrigem).to.equal(origem.address);
  });

  it("apenas owner autoriza instituicao", async () => {
    await expect(
      contrato.connect(terceiro).autorizarInstituicao(terceiro.address)
    ).to.be.revertedWith("apenas owner");
  });
});
