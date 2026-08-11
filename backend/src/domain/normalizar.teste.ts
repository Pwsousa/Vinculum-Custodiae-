import { describe, expect, it } from "vitest";
import { normalizarPoliciaCivil, normalizarSisbemjud } from "./normalizar";

const enderecoChecksum = "0x5f0ad5D7c0F067F52651ec16fcE0155bB18C392e";
const enderecoMinusculo = enderecoChecksum.toLowerCase();

describe("normalizarSisbemjud", () => {
  it("apara espaco em branco dos campos textuais", () => {
    const registroCanonico = normalizarSisbemjud({
      numeroProcesso: "  0001234-56.2026.8.26.0100  ",
      numeroLacreJudicial: " LJ-9987 ",
      dataDeposito: "2026-01-15",
      varaResponsavel: " 3a Vara Criminal ",
      enderecoBlockchain: enderecoMinusculo,
    });

    expect(registroCanonico.identificadorOrigem).toBe("0001234-56.2026.8.26.0100");
    expect(registroCanonico.numeroLacre).toBe("LJ-9987");
    expect(registroCanonico.orgaoResponsavel).toBe("3a Vara Criminal");
  });

  it("converte data DD/MM/YYYY pra ISO 8601", () => {
    const registroCanonico = normalizarSisbemjud({
      numeroProcesso: "processo-1",
      numeroLacreJudicial: "lacre-1",
      dataDeposito: "15/01/2026",
      varaResponsavel: "vara-1",
      enderecoBlockchain: enderecoMinusculo,
    });

    expect(registroCanonico.dataEvento).toBe("2026-01-15");
  });

  it("mantem data ja em ISO 8601 sem alterar", () => {
    const registroCanonico = normalizarSisbemjud({
      numeroProcesso: "processo-1",
      numeroLacreJudicial: "lacre-1",
      dataDeposito: "2026-01-15",
      varaResponsavel: "vara-1",
      enderecoBlockchain: enderecoMinusculo,
    });

    expect(registroCanonico.dataEvento).toBe("2026-01-15");
  });

  it("normaliza endereco blockchain pro formato checksum", () => {
    const registroCanonico = normalizarSisbemjud({
      numeroProcesso: "processo-1",
      numeroLacreJudicial: "lacre-1",
      dataDeposito: "2026-01-15",
      varaResponsavel: "vara-1",
      enderecoBlockchain: enderecoMinusculo,
    });

    expect(registroCanonico.enderecoBlockchain).toBe(enderecoChecksum);
  });

  it("lanca erro se endereco blockchain for invalido", () => {
    expect(() =>
      normalizarSisbemjud({
        numeroProcesso: "processo-1",
        numeroLacreJudicial: "lacre-1",
        dataDeposito: "2026-01-15",
        varaResponsavel: "vara-1",
        enderecoBlockchain: "endereco-invalido",
      })
    ).toThrow();
  });
});

describe("normalizarPoliciaCivil", () => {
  it("mapeia campos pro shape canonico", () => {
    const registroCanonico = normalizarPoliciaCivil({
      boletimOcorrencia: "BO-4567/2026",
      numeroLacre: "LP-2233",
      dataApreensao: "20/02/2026",
      delegaciaResponsavel: "5a DP",
      enderecoBlockchain: enderecoMinusculo,
    });

    expect(registroCanonico).toEqual({
      identificadorOrigem: "BO-4567/2026",
      numeroLacre: "LP-2233",
      dataEvento: "2026-02-20",
      orgaoResponsavel: "5a DP",
      enderecoBlockchain: enderecoChecksum,
    });
  });
});
