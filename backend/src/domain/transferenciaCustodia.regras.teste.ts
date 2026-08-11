import { describe, expect, it } from "vitest";
import {
  avaliarConfirmacao,
  calcularHashLacre,
  calcularItemId,
  Estado,
  ordenarAssinaturas,
  podeIniciar,
  thresholdAtingido,
} from "./transferenciaCustodia.regras";

describe("calcularHashLacre", () => {
  it("e deterministico: mesmo numero de lacre gera mesmo hash", () => {
    expect(calcularHashLacre("LJ-9987")).toBe(calcularHashLacre("LJ-9987"));
  });

  it("numeros de lacre diferentes geram hashes diferentes", () => {
    expect(calcularHashLacre("LJ-9987")).not.toBe(calcularHashLacre("LJ-9988"));
  });
});

describe("calcularItemId", () => {
  it("e deterministico: mesmo identificador interno gera mesmo hash", () => {
    expect(calcularItemId("policia-civil:bo-2024-000042")).toBe(
      calcularItemId("policia-civil:bo-2024-000042"),
    );
  });

  it("identificadores diferentes geram hashes diferentes", () => {
    expect(calcularItemId("policia-civil:bo-2024-000042")).not.toBe(
      calcularItemId("policia-civil:bo-2024-000043"),
    );
  });
});

describe("avaliarConfirmacao", () => {
  it("ressalva vazia resulta em Confirmada", () => {
    expect(avaliarConfirmacao("")).toBe(Estado.Confirmada);
  });

  it("ressalva so com espaco em branco resulta em Confirmada", () => {
    expect(avaliarConfirmacao("   ")).toBe(Estado.Confirmada);
  });

  it("ressalva com texto resulta em ConfirmadaComRessalva", () => {
    expect(avaliarConfirmacao("caixa com avaria no lacre secundario")).toBe(
      Estado.ConfirmadaComRessalva
    );
  });
});

describe("podeIniciar", () => {
  it("permite quando origem e destino sao instituicoes diferentes", () => {
    expect(podeIniciar(1n, 2n)).toBe(true);
  });

  it("bloqueia quando origem e destino sao a mesma instituicao", () => {
    expect(podeIniciar(1n, 1n)).toBe(false);
  });
});

describe("ordenarAssinaturas", () => {
  it("ordena por endereco crescente independente da ordem de entrada", () => {
    const resultado = ordenarAssinaturas([
      { endereco: "0xeF214191130A7E8a5497fdde53d158D5BbAF1A4f", assinatura: "sig-b" },
      { endereco: "0x5f0ad5D7c0F067F52651ec16fcE0155bB18C392e", assinatura: "sig-a" },
    ]);
    expect(resultado).toEqual(["sig-a", "sig-b"]);
  });
});

describe("thresholdAtingido", () => {
  it("conta enderecos unicos, ignorando caixa", () => {
    const coletadas = [
      { endereco: "0xAAAA000000000000000000000000000000000a", assinatura: "s1" },
      { endereco: "0xaaaa000000000000000000000000000000000a", assinatura: "s1-repetida" },
    ];
    expect(thresholdAtingido(coletadas, 2)).toBe(false);
    expect(thresholdAtingido(coletadas, 1)).toBe(true);
  });
});
