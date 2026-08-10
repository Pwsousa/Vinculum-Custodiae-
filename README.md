# Vinculum Custodiae

Cadeia de Custódia Interinstitucional de Bens Apreendidos (Projeto 5 — ATRD 2026.1).

Módulo de integridade que **complementa** Sisbemjud/SNGB: cada instituição mantém o próprio registro do bem; na blockchain fica só o evento de transferência (quem entregou, quem recebeu, quando, sob qual lacre), com **dupla assinatura**.

## Requisitos atendidos

| Requisito | Onde |
|-----------|------|
| Transferência com dupla assinatura (custódia só muda na contra-assinatura) | `contratos/contracts/TransferenciaCustodia.sol` |
| Recebimento com ressalva (1ª classe): lacre, peso, item faltante | Estado `ConfirmadaComRessalva` + UI tipada |
| Mocks de ≥2 sistemas com esquemas distintos | `mocks/sisbemjud`, `mocks/policia-civil` + `/reconciliacao` |
| Vínculo com lacre físico (ID / QR) | Hash do número do lacre + QR na remessa |
| Consulta da cadeia completa por instituição autorizada | `/bens/:itemId` + `consultarHistoricoItem` |
| Demo: declínio Estadual → Federal | `contratos/scripts/demo-declinio-federal.ts` + `/demo/declinio-federal` |

## Como executar

```bash
npm install

# Terminal 1 — blockchain local + deploy (ver contratos/)
# Terminal 2
npm run mock:sisbemjud
# Terminal 3
npm run mock:policia
# Terminal 4 — configurar backend/.env (RPC_URL, PRIVATE_KEY_RELAYER, REDE)
npm run backend
# Terminal 5
npm run frontend
```

Demo on-chain do declínio federal:

```bash
cd contratos
npx hardhat run scripts/demo-declinio-federal.ts
```

## Estrutura

- `contratos/` — Solidity + Hardhat + ABI
- `backend/` — Fastify (relay EIP-712 + reconciliação dos mocks)
- `frontend/` — React + Vite + ethers
- `mocks/sisbemjud` — porta **4001** (esquema judicial)
- `mocks/policia-civil` — porta **4002** (esquema policial)
