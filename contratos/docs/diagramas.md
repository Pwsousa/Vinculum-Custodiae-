# Diagramas — TransferenciaCustodia.sol

## Estados da transferência

Enum `Estado`. Recebimento com ressalva é estado de 1ª classe, não exceção. Recusa é estado
próprio — custódia permanece com a origem.

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

## Multisig por instituição (assinatura EIP-712 agregada)

Cada instituição tem N-de-M signatários. `iniciar`/`confirmar`/`recusar` recebem um array de
assinaturas EIP-712 (assinadas off-chain, em ordem crescente de endereço) em vez de depender de
`msg.sender` como único signatário.

```mermaid
sequenceDiagram
    participant S1 as Signatário A (origem)
    participant S2 as Signatário B (origem)
    participant C as TransferenciaCustodia
    participant D as Instituição destino (threshold=1)

    S1->>S1: assina IniciarTransferencia off-chain (EIP-712)
    S2->>S2: assina o mesmo hash off-chain
    S1->>C: iniciar(itemId, destinoId, hashLacre, [assinaturaA, assinaturaB])
    activate C
    C->>C: ECDSA.recover em cada assinatura, ordem crescente, sem duplicata
    C->>C: threshold da origem atingido? nonce da instituição incrementa
    C-->>S1: emit TransferenciaIniciada(id, itemId, origemId, destinoId, hashLacre)
    deactivate C

    D->>D: assina ConfirmarTransferencia off-chain
    D->>C: confirmar(id, ressalva, [assinaturaD])
    C->>C: estado = Confirmada | ConfirmadaComRessalva
    C->>C: custodianteInstituicaoAtual[itemId] = destinoId
    C-->>D: emit TransferenciaConfirmada + CustodiaAlterada
```

O `owner` do contrato (quem cadastra instituições e signatários) deve ser, em produção, uma
carteira multisig própria (ex: Gnosis Safe) — `transferirOwnership` + `aceitarOwnership` (duas
etapas) permitem migrar o owner do deployer inicial para a Safe sem risco de travar o contrato.

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

`owner` cadastra instituições e signatários. Leitura (`consultar`/`consultarHistoricoItem`) é
liberada a qualquer endereço que seja signatário de alguma instituição — não só das partes
envolvidas naquela transferência (permite, por exemplo, que um juízo federal leia o histórico sem
pedir ao juízo estadual).

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
```
