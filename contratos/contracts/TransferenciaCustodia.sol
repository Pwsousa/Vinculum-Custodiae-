// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title TransferenciaCustodia
/// @notice Registra o evento de transferência de custódia entre instituições. Cada instituição
/// tem N-de-M signatários (threshold multisig via assinatura EIP-712 agregada off-chain); o owner
/// do contrato deve ser uma carteira multisig (ex: Gnosis Safe) que cadastra e administra
/// instituições.
contract TransferenciaCustodia is EIP712 {
    enum Estado { Iniciada, Confirmada, ConfirmadaComRessalva, Recusada }

    struct Instituicao {
        string sigla;
        uint8 threshold;
        bool ativa;
    }

    struct Transferencia {
        bytes32 itemId;
        uint256 institutionOrigemId;
        uint256 institutionDestinoId;
        bytes32 hashLacre;
        Estado estado;
        string ressalva;
        uint256 timestampInicio;
        uint256 timestampConfirmacao;
    }

    bytes32 private constant INICIAR_TYPEHASH = keccak256(
        "IniciarTransferencia(bytes32 itemId,uint256 institutionOrigemId,uint256 institutionDestinoId,bytes32 hashLacre,uint256 nonce)"
    );
    bytes32 private constant CONFIRMAR_TYPEHASH = keccak256(
        "ConfirmarTransferencia(uint256 transferenciaId,bytes32 hashRessalva,uint256 nonce)"
    );
    bytes32 private constant RECUSAR_TYPEHASH = keccak256(
        "RecusarTransferencia(uint256 transferenciaId,bytes32 hashMotivo,uint256 nonce)"
    );

    mapping(uint256 => Instituicao) public instituicoes;
    mapping(uint256 => mapping(address => bool)) public signatarioDe;
    mapping(uint256 => uint256) public totalSignatarios;
    mapping(uint256 => uint256) public nonces;
    mapping(address => uint256) private acessosDeLeituraAtivos;
    uint256 public proximaInstituicaoId = 1;

    mapping(uint256 => Transferencia) public transferencias;
    uint256 public proximaTransferenciaId;

    mapping(bytes32 => bool) public itemRegistrado;
    mapping(bytes32 => uint256) public custodianteInstituicaoAtual;
    mapping(bytes32 => uint256) public transferenciaPendentePorItem;
    mapping(bytes32 => uint256[]) private historicoPorItem;
    mapping(bytes32 => bool) public lacreUtilizado;

    address public owner;
    address public ownerPendente;

    error EnderecoInvalido();
    error InstituicaoInativa();
    error AssinaturasInsuficientes();
    error AssinaturaForaDeOrdem();
    error AssinanteNaoAutorizado();

    event InstituicaoCadastrada(uint256 indexed institutionId, string sigla, uint8 threshold);
    event SignatarioAdicionado(uint256 indexed institutionId, address indexed signatario);
    event SignatarioRemovido(uint256 indexed institutionId, address indexed signatario);
    event ThresholdAlterado(uint256 indexed institutionId, uint8 threshold);
    event InstituicaoDesativada(uint256 indexed institutionId);
    event ItemRegistrado(bytes32 indexed itemId, uint256 indexed institutionId);
    event TransferenciaIniciada(
        uint256 indexed id,
        bytes32 indexed itemId,
        uint256 institutionOrigemId,
        uint256 institutionDestinoId,
        bytes32 hashLacre
    );
    event TransferenciaConfirmada(uint256 indexed id, bool comRessalva, string ressalva);
    event TransferenciaRecusada(uint256 indexed id, string motivo);
    event CustodiaAlterada(bytes32 indexed itemId, uint256 indexed institutionId);
    event OwnershipProposta(address indexed novoOwner);
    event OwnershipTransferida(address indexed owner);

    modifier apenasOwner() {
        require(msg.sender == owner, "apenas owner");
        _;
    }

    modifier apenasSignatario(uint256 institutionId) {
        require(signatarioDe[institutionId][msg.sender], "nao e signatario da instituicao");
        _;
    }

    /// @dev Signatários de qualquer instituição leem a cadeia; o owner (ex.: relayer do backend)
    /// também, pois as consultas HTTP usam a wallet do relayer e não a do usuário final.
    modifier apenasComAcessoDeLeitura() {
        require(
            msg.sender == owner || acessosDeLeituraAtivos[msg.sender] > 0,
            "sem acesso de leitura"
        );
        _;
    }

    /// @notice Define o owner inicial do contrato (idealmente uma carteira multisig, ex: Gnosis Safe).
    /// @param ownerInicial Endereço que administra instituições até a próxima transferência de ownership.
    constructor(address ownerInicial) EIP712("TransferenciaCustodia", "1") {
        if (ownerInicial == address(0)) revert EnderecoInvalido();
        owner = ownerInicial;
    }

    // ---------- Administração (owner) ----------

    /// @notice Cadastra uma instituição com threshold de assinaturas próprio.
    /// @param sigla Identificador curto da instituição (ex: "DELEG-01").
    /// @param threshold Número mínimo de signatários que devem assinar cada ação da instituição.
    /// @return institutionId Identificador da instituição criada.
    function cadastrarInstituicao(string calldata sigla, uint8 threshold)
        external
        apenasOwner
        returns (uint256 institutionId)
    {
        require(threshold > 0, "threshold invalido");
        institutionId = proximaInstituicaoId++;
        instituicoes[institutionId] = Instituicao({ sigla: sigla, threshold: threshold, ativa: true });
        emit InstituicaoCadastrada(institutionId, sigla, threshold);
    }

    /// @notice Adiciona um endereço signatário à instituição.
    /// @param institutionId Instituição que ganha o novo signatário.
    /// @param signatario Endereço autorizado a assinar ações desta instituição.
    function adicionarSignatario(uint256 institutionId, address signatario) external apenasOwner {
        require(instituicoes[institutionId].ativa, "instituicao inexistente");
        if (signatario == address(0)) revert EnderecoInvalido();
        require(!signatarioDe[institutionId][signatario], "ja e signatario");
        signatarioDe[institutionId][signatario] = true;
        totalSignatarios[institutionId]++;
        acessosDeLeituraAtivos[signatario]++;
        emit SignatarioAdicionado(institutionId, signatario);
    }

    /// @notice Remove um endereço signatário da instituição. Bloqueado se a remoção deixar
    /// a instituição com menos signatários do que seu threshold exige.
    function removerSignatario(uint256 institutionId, address signatario) external apenasOwner {
        require(signatarioDe[institutionId][signatario], "nao e signatario");
        require(
            totalSignatarios[institutionId] > instituicoes[institutionId].threshold,
            "removeria abaixo do threshold"
        );
        signatarioDe[institutionId][signatario] = false;
        totalSignatarios[institutionId]--;
        acessosDeLeituraAtivos[signatario]--;
        emit SignatarioRemovido(institutionId, signatario);
    }

    /// @notice Altera o threshold de assinaturas exigido da instituição.
    function alterarThreshold(uint256 institutionId, uint8 novoThreshold) external apenasOwner {
        require(instituicoes[institutionId].ativa, "instituicao inexistente");
        require(
            novoThreshold > 0 && novoThreshold <= totalSignatarios[institutionId],
            "threshold invalido"
        );
        instituicoes[institutionId].threshold = novoThreshold;
        emit ThresholdAlterado(institutionId, novoThreshold);
    }

    /// @notice Desativa a instituição: bloqueia iniciar/confirmar/recusar subsequentes.
    /// Histórico já registrado permanece consultável por quem ainda tiver acesso de leitura.
    function desativarInstituicao(uint256 institutionId) external apenasOwner {
        instituicoes[institutionId].ativa = false;
        emit InstituicaoDesativada(institutionId);
    }

    /// @notice Propõe transferência do ownership do contrato (ex: para uma Gnosis Safe recém-implantada).
    /// Só se efetiva quando o endereço proposto chama aceitarOwnership().
    function transferirOwnership(address novoOwner) external apenasOwner {
        if (novoOwner == address(0)) revert EnderecoInvalido();
        ownerPendente = novoOwner;
        emit OwnershipProposta(novoOwner);
    }

    /// @notice Aceita o ownership proposto. Na prática, é a própria carteira/Safe proposta
    /// que executa esta chamada.
    function aceitarOwnership() external {
        require(msg.sender == ownerPendente, "apenas owner pendente");
        owner = ownerPendente;
        ownerPendente = address(0);
        emit OwnershipTransferida(owner);
    }

    // ---------- Itens ----------

    /// @notice Registra a custódia inicial de um item físico (bem apreendido) sob uma instituição.
    /// @param institutionId Instituição que detém a custódia inicial.
    /// @param itemId Hash único do item, calculado fora da chain a partir do registro interno
    /// da instituição. Persiste como identidade do bem por toda a cadeia de custódia, mesmo
    /// quando o lacre físico muda a cada transporte.
    function registrarItem(uint256 institutionId, bytes32 itemId) external apenasSignatario(institutionId) {
        require(!itemRegistrado[itemId], "item ja registrado");
        itemRegistrado[itemId] = true;
        custodianteInstituicaoAtual[itemId] = institutionId;
        emit ItemRegistrado(itemId, institutionId);
    }

    // ---------- Transferências (multisig EIP-712) ----------

    /// @notice Primeira assinatura: threshold de signatários da instituição de origem inicia
    /// a transferência do item vinculada ao lacre físico deste transporte (QR).
    /// @param itemId Item físico sob custódia sendo transferido.
    /// @param institutionDestinoId Instituição que vai receber a custódia.
    /// @param hashLacre Hash do QR do lacre físico deste transporte.
    /// @param assinaturas Assinaturas EIP-712 dos signatários da instituição de origem, em ordem
    /// crescente de endereço (evita duplicidade de assinante).
    /// @return id Identificador da transferência criada.
    function iniciar(
        bytes32 itemId,
        uint256 institutionDestinoId,
        bytes32 hashLacre,
        bytes[] calldata assinaturas
    ) external returns (uint256 id) {
        require(itemRegistrado[itemId], "item nao registrado");
        uint256 institutionOrigemId = custodianteInstituicaoAtual[itemId];
        require(institutionOrigemId != institutionDestinoId, "origem nao pode ser destino");
        require(instituicoes[institutionDestinoId].ativa, "destino nao autorizado");
        require(transferenciaPendentePorItem[itemId] == 0, "ja existe transferencia pendente");
        require(!lacreUtilizado[hashLacre], "lacre ja utilizado");

        uint256 nonce = nonces[institutionOrigemId];
        bytes32 dadosAssinados = keccak256(
            abi.encode(INICIAR_TYPEHASH, itemId, institutionOrigemId, institutionDestinoId, hashLacre, nonce)
        );
        _verificarMultisig(institutionOrigemId, _hashTypedDataV4(dadosAssinados), assinaturas);
        nonces[institutionOrigemId] = nonce + 1;

        id = ++proximaTransferenciaId;
        transferencias[id] = Transferencia({
            itemId: itemId,
            institutionOrigemId: institutionOrigemId,
            institutionDestinoId: institutionDestinoId,
            hashLacre: hashLacre,
            estado: Estado.Iniciada,
            ressalva: "",
            timestampInicio: block.timestamp,
            timestampConfirmacao: 0
        });
        lacreUtilizado[hashLacre] = true;
        transferenciaPendentePorItem[itemId] = id;
        historicoPorItem[itemId].push(id);

        emit TransferenciaIniciada(id, itemId, institutionOrigemId, institutionDestinoId, hashLacre);
    }

    /// @notice Segunda assinatura: threshold de signatários da instituição de destino confirma
    /// recebimento. Ressalva não vazia muda estado pra ConfirmadaComRessalva (estado válido de
    /// 1ª classe, não exceção).
    /// @param id Identificador da transferência.
    /// @param ressalva Observação do recebimento; string vazia se não houver.
    /// @param assinaturas Assinaturas EIP-712 dos signatários da instituição de destino, em ordem
    /// crescente de endereço.
    function confirmar(uint256 id, string calldata ressalva, bytes[] calldata assinaturas) external {
        Transferencia storage t = transferencias[id];
        require(t.estado == Estado.Iniciada, "estado invalido");

        uint256 nonce = nonces[t.institutionDestinoId];
        bytes32 dadosAssinados = keccak256(
            abi.encode(CONFIRMAR_TYPEHASH, id, keccak256(bytes(ressalva)), nonce)
        );
        _verificarMultisig(t.institutionDestinoId, _hashTypedDataV4(dadosAssinados), assinaturas);
        nonces[t.institutionDestinoId] = nonce + 1;

        bool temRessalva = bytes(ressalva).length > 0;
        t.estado = temRessalva ? Estado.ConfirmadaComRessalva : Estado.Confirmada;
        t.ressalva = ressalva;
        t.timestampConfirmacao = block.timestamp;
        custodianteInstituicaoAtual[t.itemId] = t.institutionDestinoId;
        transferenciaPendentePorItem[t.itemId] = 0;

        emit TransferenciaConfirmada(id, temRessalva, ressalva);
        emit CustodiaAlterada(t.itemId, t.institutionDestinoId);
    }

    /// @notice Threshold de signatários da instituição de destino recusa o recebimento. Custódia
    /// permanece com a origem; o lacre já utilizado não é liberado (selo físico já rompido na
    /// tentativa de entrega).
    /// @param id Identificador da transferência.
    /// @param motivo Justificativa da recusa.
    /// @param assinaturas Assinaturas EIP-712 dos signatários da instituição de destino, em ordem
    /// crescente de endereço.
    function recusar(uint256 id, string calldata motivo, bytes[] calldata assinaturas) external {
        Transferencia storage t = transferencias[id];
        require(t.estado == Estado.Iniciada, "estado invalido");

        uint256 nonce = nonces[t.institutionDestinoId];
        bytes32 dadosAssinados = keccak256(
            abi.encode(RECUSAR_TYPEHASH, id, keccak256(bytes(motivo)), nonce)
        );
        _verificarMultisig(t.institutionDestinoId, _hashTypedDataV4(dadosAssinados), assinaturas);
        nonces[t.institutionDestinoId] = nonce + 1;

        t.estado = Estado.Recusada;
        t.ressalva = motivo;
        t.timestampConfirmacao = block.timestamp;
        transferenciaPendentePorItem[t.itemId] = 0;

        emit TransferenciaRecusada(id, motivo);
    }

    // ---------- Consulta ----------

    /// @notice Lê os dados de uma transferência. Restrito a signatários ou ao owner (relayer).
    function consultar(uint256 id) external view apenasComAcessoDeLeitura returns (Transferencia memory) {
        return transferencias[id];
    }

    /// @notice Retorna o histórico de IDs de transferência vinculados a um item físico.
    function consultarHistoricoItem(bytes32 itemId)
        external
        view
        apenasComAcessoDeLeitura
        returns (uint256[] memory)
    {
        return historicoPorItem[itemId];
    }

    // ---------- Interno ----------

    /// @dev Verifica que `assinaturas` reúne, no mínimo, o threshold de signatários únicos e
    /// autorizados da instituição sobre `hashParaAssinar`. Assinaturas devem vir ordenadas por
    /// endereço crescente — isso barra duplicidade de assinante sem precisar de um set em memória.
    function _verificarMultisig(uint256 institutionId, bytes32 hashParaAssinar, bytes[] calldata assinaturas)
        private
        view
    {
        Instituicao storage inst = instituicoes[institutionId];
        if (!inst.ativa) revert InstituicaoInativa();
        if (assinaturas.length < inst.threshold) revert AssinaturasInsuficientes();

        address ultimoSignatario = address(0);
        for (uint256 i = 0; i < assinaturas.length; i++) {
            address signatario = ECDSA.recover(hashParaAssinar, assinaturas[i]);
            if (signatario <= ultimoSignatario) revert AssinaturaForaDeOrdem();
            if (!signatarioDe[institutionId][signatario]) revert AssinanteNaoAutorizado();
            ultimoSignatario = signatario;
        }
    }
}
