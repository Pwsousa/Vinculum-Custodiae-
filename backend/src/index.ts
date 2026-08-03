import { criarServidor } from "./shell/servidor";
import { configuracao } from "./shell/config";

criarServidor()
  .then((app) => app.listen({ port: configuracao.porta, host: "0.0.0.0" }))
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
