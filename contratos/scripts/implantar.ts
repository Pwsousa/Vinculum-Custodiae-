import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const Fabrica = await ethers.getContractFactory("TransferenciaCustodia");
  const contrato = await Fabrica.deploy();
  await contrato.waitForDeployment();

  const endereco = await contrato.getAddress();
  console.log(`TransferenciaCustodia implantado em ${network.name}: ${endereco}`);

  const pastaAbi = path.join(__dirname, "..", "pacote-abi");
  const caminhoEnderecos = path.join(pastaAbi, "enderecos.json");

  const enderecos = fs.existsSync(caminhoEnderecos)
    ? JSON.parse(fs.readFileSync(caminhoEnderecos, "utf-8"))
    : {};
  enderecos[network.name] = endereco;
  fs.writeFileSync(caminhoEnderecos, JSON.stringify(enderecos, null, 2));

  const artefato = await import(
    path.join(__dirname, "..", "artifacts", "contracts", "TransferenciaCustodia.sol", "TransferenciaCustodia.json")
  );
  fs.writeFileSync(
    path.join(pastaAbi, "TransferenciaCustodia.json"),
    JSON.stringify(artefato.abi, null, 2)
  );
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
