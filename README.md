# Vinculum Custodiae

Cadeia de Custódia Interinstitucional de Bens Apreendidos (Projeto 5 — ATRD 2026.1).

Módulo de integridade que **complementa** Sisbemjud/SNGB: cada instituição mantém o próprio registro do bem; na blockchain fica só o evento de transferência (quem entregou, quem recebeu, quando, sob qual lacre), com **dupla assinatura**.

A custódia só muda na **2ª assinatura** (destino). O `itemId` (hash do bem) permanece o mesmo; o que muda é a instituição custodiante.

## Requisitos atendidos

| Requisito | Onde |
|-----------|------|
| Transferência com dupla assinatura (custódia só muda na contra-assinatura) | `contratos/contracts/TransferenciaCustodia.sol` |
| Recebimento com ressalva (1ª classe): lacre, peso, item faltante | Estado `ConfirmadaComRessalva` + UI tipada |
| Mocks de ≥2 sistemas com esquemas distintos | `mocks/sisbemjud`, `mocks/policia-civil` + `/reconciliacao` |
| Vínculo com lacre físico (ID / QR) | Hash do número do lacre + QR na remessa |
| Consulta da cadeia completa por instituição autorizada | `/bens/:itemId` + `consultarHistoricoItem` |
| Cadastro de instituições / signatários pelo owner | `/admin/instituicoes` |
| Painel, remessas pendentes e histórico | `/painel`, `/remessas`, `/historico` |
| Demo: declínio Estadual → Federal | `contratos/scripts/demo-declinio-federal.ts` + `/demo/declinio-federal` |

Diagramas do contrato: [`contratos/docs/diagramas.md`](contratos/docs/diagramas.md).

## Como executar (localhost)

```bash
npm install
```

Use **vários terminais** na raiz do monorepo (exceto onde indicado `cd contratos`):

| Terminal | Comando | Função |
|----------|---------|--------|
| 1 | `cd contratos && npx hardhat node` | Blockchain local (`http://127.0.0.1:8545`, chain id `31337`) |
| 2 | `cd contratos && npm run implantar:local` | Deploy + grava endereço em `contratos/pacote-abi/enderecos.json` |
| 3 | `npm run backend` | API Fastify (relay EIP-712) na porta **3333** |
| 4 | `npm run frontend` | Vite em geral em `http://localhost:5173` |
| 5 (opcional) | `npm run mock:sisbemjud` | Mock judicial porta **4001** |
| 6 (opcional) | `npm run mock:policia` | Mock policial porta **4002** |

### Variáveis de ambiente

**`backend/.env`** (a partir de `backend/.env.example`):

```env
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY_RELAYER=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
REDE=localhost
PORTA=3333
```

Use a chave da **Account #0** do Hardhat como relayer (paga gás; não precisa ser signatário das instituições).

**`frontend/.env`** (opcional; já tem default):

```env
VITE_API_URL=http://localhost:3333
VITE_REDE_CONTRATO=localhost
```

### MetaMask (Hardhat local)

- RPC: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Importe as Accounts #0 (owner), #1, #2… do terminal do `hardhat node`

> Ao reiniciar o `hardhat node`, o estado zera: rode `npm run implantar:local` de novo e recadastre instituições.

### Fluxo principal (demo)

1. Conecte a **Account #0** → `/admin/instituicoes`
   - Cadastre ex.: `POLICIA` (threshold 1) e `PERICIA` (threshold 1)
   - Autorize Account #1 na instituição `1` e Account #2 na `2`
2. Conta **Polícia** → `/bens/novo` → registrar bem (copie o `itemId`)
3. Ainda Polícia → `/transferencias/nova` → destino `2` + número de lacre → assinar remessa
4. Conta **Perícia** → `/remessas` (ID `2`) → **Confirmar recebimento**
5. `/bens/:itemId` e `/historico` mostram a mudança de custódia (origem → destino)

## Rotas do frontend

| Rota | Uso |
|------|-----|
| `/auth` | Conectar MetaMask |
| `/painel` | Visão operacional da instituição |
| `/remessas` | Remessas aguardando contra-assinatura |
| `/historico` | Histórico de transferências |
| `/bens/novo` | Registrar custódia inicial |
| `/transferencias/nova` | Iniciar remessa (1ª assinatura) |
| `/transferencias/:id` | Detalhe + confirmar/recusar + bloco custódia anterior/atual |
| `/bens/:itemId` | Cadeia de custódia do item |
| `/admin/instituicoes` | Owner: instituições e signatários |
| `/reconciliacao` | Comparar mocks Sisbemjud × Polícia |
| `/demo/declinio-federal` | Roteiro da demo federal |

## Demo on-chain (script)

```bash
cd contratos
npx hardhat run scripts/demo-declinio-federal.ts
```

## Estrutura

- `contratos/` — Solidity + Hardhat + ABI (`pacote-abi/`)
- `backend/` — Fastify (relay EIP-712 + reconciliação dos mocks)
- `frontend/` — React + Vite + ethers
- `mocks/sisbemjud` — porta **4001** (esquema judicial)
- `mocks/policia-civil` — porta **4002** (esquema policial)

## Nota sobre o MetaMask

Chamadas `eth_call` com `<unrecognized-selector>` no log do Hardhat costumam ser o MetaMask tentando ler o contrato como ERC-20. Se a interação aparecer **Confirmada** e o front atualizar, a transferência está ok.
