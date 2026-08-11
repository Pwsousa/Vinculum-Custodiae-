# Diagramas — TransferenciaCustodia.sol

## Estados da transferência

Enum `Estado`. Recebimento com ressalva é estado de 1ª classe, não exceção. Recusa é estado
próprio — custódia permanece com a origem. A custódia do item (`custodianteInstituicaoAtual`)
só muda em `Confirmada` / `ConfirmadaComRessalva`.

```mermaid
stateDiagram-v2
    [*] --> Iniciada: iniciar() — threshold da origem assina
    Iniciada --> Confirmada: confirmar(id, "") — threshold do destino, sem ressalva
    Iniciada --> ConfirmadaComRessalva: confirmar(id, texto) — threshold do destino, com ressalva
    Iniciada --> Recusada: recusar(id, motivo) — threshold do destino recusa
    Confirmada --> [*]
    ConfirmadaComRessalva --> [*]
    Recusada --> [*]
```

## Mudança de custódia (dupla assinatura)

O `itemId` (hash do bem) **não muda**. O que muda após a 2ª assinatura é a instituição
custodiante. Enquanto o estado for `Iniciada`, a responsabilidade permanece com a origem.

```mermaid
flowchart LR
    subgraph antes ["Após iniciar()"]
        A["custodiante = origem"]
        B["estado = Iniciada"]
        C["transferenciaPendentePorItem = id"]
    end
    subgraph depois ["Após confirmar()"]
        D["custodiante = destino"]
        E["estado = Confirmada | ConfirmadaComRessalva"]
        F["transferenciaPendentePorItem = 0"]
    end
    antes -->|"2ª assinatura EIP-712 do destino"| depois
```

## Multisig por instituição (assinatura EIP-712 agregada)

Cada instituição tem N-de-M signatários. `iniciar`/`confirmar`/`recusar` recebem um array de
assinaturas EIP-712 (assinadas off-chain, em ordem crescente de endereço) em vez de depender de
`msg.sender` como único signatário.

No stack desta PoC, o **frontend** coleta a assinatura na MetaMask e o **backend** (relayer)
envia a transação on-chain — a chave privada institucional nunca passa pelo servidor.

```mermaid
sequenceDiagram
    participant UI as Frontend (MetaMask)
    participant API as Backend (relayer)
    participant C as TransferenciaCustodia

    Note over UI,C: 1ª assinatura — origem inicia remessa
    UI->>API: GET /transferencias/preparar-iniciar
    API-->>UI: domínio + tipos EIP-712 + valor
    UI->>UI: signTypedData (wallet da origem)
    UI->>API: POST /transferencias/iniciar + assinaturas
    API->>C: iniciar(itemId, destinoId, hashLacre, assinaturas)
    C-->>API: TransferenciaIniciada
    API-->>UI: { txHash, id }

    Note over UI,C: 2ª assinatura — destino confirma (custódia muda)
    UI->>API: GET /transferencias/:id/preparar-confirmar
    UI->>UI: signTypedData (wallet do destino)
    UI->>API: POST /transferencias/:id/confirmar
    API->>C: confirmar(id, ressalva, assinaturas)
    C->>C: custodianteInstituicaoAtual[itemId] = destinoId
    C-->>API: TransferenciaConfirmada + CustodiaAlterada
```

O `owner` do contrato (quem cadastra instituições e signatários) deve ser, em produção, uma
carteira multisig própria (ex: Gnosis Safe) — `transferirOwnership` + `aceitarOwnership` (duas
etapas) permitem migrar o owner do deployer inicial para a Safe sem risco de travar o contrato.

Em localhost (Hardhat), a Account #0 é owner e também `PRIVATE_KEY_RELAYER` do backend.

## itemId vs hashLacre

`itemId` é o hash único do **bem físico** — persiste por toda a cadeia de custódia, mesmo quando
o lacre muda a cada transporte. `hashLacre` é o selo físico **daquele transporte específico**;
uma vez usado, fica marcado (`lacreUtilizado`) e não pode ser reaproveitado por outro item.

```mermaid
erDiagram
    ITEM {
        bytes32 itemId
        uint256 custodianteInstituicaoAtual
    }
    TRANSFERENCIA {
        bytes32 itemId
        uint256 institutionOrigemId
        uint256 institutionDestinoId
        bytes32 hashLacre
        Estado estado
        string ressalva
        uint256 timestampInicio
        uint256 timestampConfirmacao
    }
    INSTITUICAO {
        uint256 institutionId
        string sigla
        uint8 threshold
        bool ativa
    }

    ITEM ||--o{ TRANSFERENCIA : "historicoPorItem[itemId] -> id[]"
    INSTITUICAO ||--o{ TRANSFERENCIA : "origem / destino"
```

`registrarItem(institutionId, itemId)` estabelece a custódia inicial (qualquer signatário da
instituição, sem threshold — ato de baixo risco comparado a uma transferência real). A partir
daí, só quem é `custodianteInstituicaoAtual[itemId]` pode iniciar uma nova transferência, e só
existe uma transferência pendente por item por vez (`transferenciaPendentePorItem`).

## Controle de acesso

`owner` cadastra instituições e signatários (no front: `/admin/instituicoes`). Leitura
(`consultar` / `consultarHistoricoItem`) é liberada a:

- qualquer endereço que seja **signatário** de alguma instituição, e
- o **owner** (para o backend/relayer poder montar painel e histórico sem ser signatário).

Isso permite, por exemplo, que um juízo federal (signatário de instituição autorizada) leia o
histórico sem pedir ao juízo estadual.

```mermaid
flowchart LR
    Owner(["owner (idealmente uma Safe)"])
    Owner -- "cadastrarInstituicao(sigla, threshold)" --> Inst[("instituicoes[id]")]
    Owner -- "adicionarSignatario/removerSignatario" --> Sig[("signatarioDe[id][addr]")]
    Owner -- "alterarThreshold / desativarInstituicao" --> Inst

    Sig -.gate multisig.-> Iniciar["iniciar()"]
    Sig -.gate multisig.-> Confirmar["confirmar()"]
    Sig -.gate multisig.-> Recusar["recusar()"]
    Sig -.gate leitura.-> Consultar["consultar() / consultarHistoricoItem()"]
    Owner -.gate leitura.-> Consultar
```

## Fluxo operacional na UI

```mermaid
flowchart TD
    A["Owner: /admin/instituicoes\ncadastra instituições + signatários"] --> B["Signatário origem: /bens/novo\nregistrarItem"]
    B --> C["Origem: /transferencias/nova\niniciar remessa + lacre"]
    C --> D["Estado Iniciada\ncustódia ainda na origem"]
    D --> E["Destino: /remessas\nconfirma ou recusa"]
    E -->|confirmar| F["Custódia atual = destino\n/bens/:itemId + /historico"]
    E -->|recusar| G["Custódia permanece na origem\nlacre consumido"]
```
