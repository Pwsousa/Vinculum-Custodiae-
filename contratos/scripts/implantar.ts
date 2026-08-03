import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  // Em produção, OWNER_ADDRESS deve ser uma carteira multisig (ex: Gnosis Safe) já implantada.
  // Sem a env var, o owner inicial é o próprio deployer (conveniente em localhost/dev).
  const enderecoOwner = process.env.OWNER_ADDRESS || deployer.address;

  const Fabrica = await ethers.getContractFactory("TransferenciaCustodia");
  const contrato = await Fabrica.deploy(enderecoOwner);
  await contrato.waitForDeployment();

  const endereco = await contrato.getAddress();
  console.log(`TransferenciaCustodia implantado em ${network.name}: ${endereco}`);
  console.log(`Owner inicial: ${enderecoOwner}`);

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
