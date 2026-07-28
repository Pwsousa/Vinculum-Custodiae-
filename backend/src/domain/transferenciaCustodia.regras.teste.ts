import { describe, expect, it } from "vitest";
import {
  avaliarConfirmacao,
  calcularHashLacre,
  Estado,
  podeIniciar,
} from "./transferenciaCustodia.regras";

describe("calcularHashLacre", () => {
  it("e deterministico: mesmo numero de lacre gera mesmo hash", () => {
    expect(calcularHashLacre("LJ-9987")).toBe(calcularHashLacre("LJ-9987"));
  });

  it("numeros de lacre diferentes geram hashes diferentes", () => {
    expect(calcularHashLacre("LJ-9987")).not.toBe(calcularHashLacre("LJ-9988"));
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
  const enderecoOrigem = "0x5f0ad5D7c0F067F52651ec16fcE0155bB18C392e";
  const enderecoDestino = "0xeF214191130A7E8a5497fdde53d158D5BbAF1A4f";

  it("permite quando origem e destino sao diferentes", () => {
    expect(podeIniciar(enderecoOrigem, enderecoDestino)).toBe(true);
  });

  it("bloqueia quando origem e destino sao o mesmo endereco", () => {
    expect(podeIniciar(enderecoOrigem, enderecoOrigem)).toBe(false);
  });

  it("bloqueia mesmo endereco com caixa diferente (case-insensitive)", () => {
    expect(podeIniciar(enderecoOrigem, enderecoOrigem.toLowerCase())).toBe(false);
  });
});
