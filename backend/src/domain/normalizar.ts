import { getAddress } from "ethers";

export type RegistroSisbemjud = {
  numeroProcesso: string;
  numeroLacreJudicial: string;
  dataDeposito: string;
  varaResponsavel: string;
  enderecoBlockchain: string;
};

export type RegistroPoliciaCivil = {
  boletimOcorrencia: string;
  numeroLacre: string;
  dataApreensao: string;
  delegaciaResponsavel: string;
  enderecoBlockchain: string;
};

export type RegistroCanonico = {
  identificadorOrigem: string;
  numeroLacre: string;
  dataEvento: string;
  orgaoResponsavel: string;
  enderecoBlockchain: string;
};

function normalizarData(data: string): string {
  const dataAparada = data.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(dataAparada)) {
    return dataAparada;
  }
  const [dia, mes, ano] = dataAparada.split("/");
  if (dia && mes && ano) {
    return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  }
  return dataAparada;
}

export function normalizarSisbemjud(registro: RegistroSisbemjud): RegistroCanonico {
  return {
    identificadorOrigem: registro.numeroProcesso.trim(),
    numeroLacre: registro.numeroLacreJudicial.trim(),
    dataEvento: normalizarData(registro.dataDeposito),
    orgaoResponsavel: registro.varaResponsavel.trim(),
    enderecoBlockchain: getAddress(registro.enderecoBlockchain),
  };
}

export function normalizarPoliciaCivil(registro: RegistroPoliciaCivil): RegistroCanonico {
  return {
    identificadorOrigem: registro.boletimOcorrencia.trim(),
    numeroLacre: registro.numeroLacre.trim(),
    dataEvento: normalizarData(registro.dataApreensao),
    orgaoResponsavel: registro.delegaciaResponsavel.trim(),
    enderecoBlockchain: getAddress(registro.enderecoBlockchain),
  };
}
