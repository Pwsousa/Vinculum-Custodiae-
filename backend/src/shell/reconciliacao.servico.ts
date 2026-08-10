import type { RegistroPoliciaCivil, RegistroSisbemjud } from "../domain/normalizar";
import { reconciliarRegistros, type ResultadoReconciliacao } from "../domain/ressalva";

export type ConfigMocks = {
  urlSisbemjud: string;
  urlPoliciaCivil: string;
};

async function buscarJson<T>(url: string): Promise<T | null> {
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return null;
    return (await resposta.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Consulta os dois mocks com esquemas distintos e devolve visão reconciliada.
 * A chave pode ser itemId (hash) ou identificador cruzado conhecido nos seeds.
 */
export async function reconciliarPorItemId(
  itemId: string,
  config: ConfigMocks,
): Promise<ResultadoReconciliacao> {
  const [sisbemjud, policiaCivil] = await Promise.all([
    buscarJson<RegistroSisbemjud>(
      `${config.urlSisbemjud}/bens/por-item/${encodeURIComponent(itemId)}`,
    ),
    buscarJson<RegistroPoliciaCivil>(
      `${config.urlPoliciaCivil}/apreensoes/hash/${encodeURIComponent(itemId)}`,
    ),
  ]);

  return reconciliarRegistros(itemId, { sisbemjud, policiaCivil });
}

export async function listarVisoesInstitucionais(config: ConfigMocks) {
  const [sisbemjud, policiaCivil] = await Promise.all([
    buscarJson<{ sistema: string; esquema: string; bens: RegistroSisbemjud[] }>(
      `${config.urlSisbemjud}/bens`,
    ),
    buscarJson<{
      sistema: string;
      esquema: string;
      apreensoes: RegistroPoliciaCivil[];
    }>(`${config.urlPoliciaCivil}/apreensoes`),
  ]);

  return {
    sisbemjud: sisbemjud ?? {
      sistema: "Sisbemjud (indisponível)",
      esquema: "",
      bens: [],
    },
    policiaCivil: policiaCivil ?? {
      sistema: "Polícia Civil (indisponível)",
      esquema: "",
      apreensoes: [],
    },
  };
}
