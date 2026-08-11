import { describe, expect, it } from "vitest";
import { formatarRessalva, parsearRessalva, reconciliarRegistros } from "./ressalva";

const endereco = "0x5f0ad5D7c0F067F52651ec16fcE0155bB18C392e";

describe("formatarRessalva", () => {
  it("serializa categoria tipada sem detalhe", () => {
    expect(formatarRessalva("lacre_rompido")).toBe("[Lacre rompido]");
  });

  it("serializa categoria com detalhe", () => {
    expect(formatarRessalva("divergencia_peso", "esperado 1250g, medido 1180g")).toBe(
      "[Divergência de peso] esperado 1250g, medido 1180g",
    );
  });
});

describe("parsearRessalva", () => {
  it("extrai categoria e detalhe", () => {
    expect(parsearRessalva("[Item faltante] falta o carregador")).toEqual({
      tipo: "Item faltante",
      detalhe: "falta o carregador",
    });
  });

  it("mantem texto livre sem categoria", () => {
    expect(parsearRessalva("lacre rompido na entrega")).toEqual({
      detalhe: "lacre rompido na entrega",
    });
  });
});

describe("reconciliarRegistros", () => {
  it("detecta convergencia de endereco e divergencia de lacre", () => {
    const resultado = reconciliarRegistros("item-demo", {
      sisbemjud: {
        numeroProcesso: "0001234-56.2026.8.15.2001",
        numeroLacreJudicial: "LJ-88421",
        dataDeposito: "2026-03-12",
        varaResponsavel: "2ª Vara Criminal",
        enderecoBlockchain: endereco,
      },
      policiaCivil: {
        boletimOcorrencia: "BO-2026-004812",
        numeroLacre: "PC-PB-77201",
        dataApreensao: "12/03/2026",
        delegaciaResponsavel: "DRE",
        enderecoBlockchain: endereco.toLowerCase(),
      },
    });

    expect(resultado.convergencias.some((c) => c.includes("enderecoBlockchain"))).toBe(true);
    expect(resultado.divergencias.some((d) => d.includes("lacres distintos"))).toBe(true);
    expect(resultado.canonicos.sisbemjud?.dataEvento).toBe("2026-03-12");
    expect(resultado.canonicos.policiaCivil?.dataEvento).toBe("2026-03-12");
  });
});
