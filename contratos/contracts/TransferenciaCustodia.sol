// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TransferenciaCustodia
/// @notice Registra o evento de transferência de custódia entre instituições
contract TransferenciaCustodia {
    enum Estado { Iniciada, Confirmada, ConfirmadaComRessalva }

    struct Transferencia {
        address instituicaoOrigem;
        address instituicaoDestino;
        bytes32 hashLacre;
        Estado estado;
        string ressalva;
        uint256 timestampInicio;
        uint256 timestampConfirmacao;
    }

    mapping(uint256 => Transferencia) public transferencias;
    mapping(address => bool) public instituicoesAutorizadas;
    uint256 public proximoId;
    address public owner;

    error EnderecoInvalido();

    event TransferenciaIniciada(uint256 indexed id, address indexed origem, address indexed destino, bytes32 hashLacre);
    event TransferenciaConfirmada(uint256 indexed id, bool comRessalva, string ressalva);
    event InstituicaoAutorizada(address indexed instituicao);
    event InstituicaoRevogada(address indexed instituicao);

    modifier apenasAutorizada() {
        require(instituicoesAutorizadas[msg.sender], "instituicao nao autorizada");
        _;
    }

    /// @notice Define o deployer como owner, para autorizar instituições.
    constructor() {
        owner = msg.sender;
    }

    /// @notice Libera um endereço de instituição a iniciar/confirmar/consultar transferências.
    /// @param instituicao Endereço da instituição a autorizar.
    function autorizarInstituicao(address instituicao) external {
        require(msg.sender == owner, "apenas owner");
        if (instituicao == address(0)) revert EnderecoInvalido();
        instituicoesAutorizadas[instituicao] = true;
        emit InstituicaoAutorizada(instituicao);
    }

    /// @notice Revoga autorização de uma instituição (ex: chave comprometida).
    /// @param instituicao Endereço da instituição a revogar.
    function revogarInstituicao(address instituicao) external {
        require(msg.sender == owner, "apenas owner");
        instituicoesAutorizadas[instituicao] = false;
        emit InstituicaoRevogada(instituicao);
    }

    /// @notice Primeira assinatura: origem abre transferência vinculada ao lacre físico (QR).
    /// @param destino Endereço da instituição que vai receber a custódia.
    /// @param hashLacre Hash do QR do lacre físico.
    /// @return id Identificador da transferência criada.
    function iniciar(address destino, bytes32 hashLacre) external apenasAutorizada returns (uint256 id) {
        require(instituicoesAutorizadas[destino], "destino nao autorizado");
        require(destino != msg.sender, "origem nao pode ser destino");
        id = proximoId++;
        transferencias[id] = Transferencia({
            instituicaoOrigem: msg.sender,
            instituicaoDestino: destino,
            hashLacre: hashLacre,
            estado: Estado.Iniciada,
            ressalva: "",
            timestampInicio: block.timestamp,
            timestampConfirmacao: 0
        });
        emit TransferenciaIniciada(id, msg.sender, destino, hashLacre);
    }

    /// @notice Segunda assinatura: destino confirma recebimento. Ressalva não vazia muda estado
    /// pra ConfirmadaComRessalva (estado válido de 1ª classe, não exceção).
    /// @param id Identificador da transferência.
    /// @param ressalva Observação do recebimento; string vazia se não houver.
    function confirmar(uint256 id, string calldata ressalva) external apenasAutorizada {
        Transferencia storage t = transferencias[id];
        require(t.estado == Estado.Iniciada, "estado invalido");
        require(msg.sender == t.instituicaoDestino, "apenas destino confirma");

        bool temRessalva = bytes(ressalva).length > 0;
        t.estado = temRessalva ? Estado.ConfirmadaComRessalva : Estado.Confirmada;
        t.ressalva = ressalva;
        t.timestampConfirmacao = block.timestamp;

        emit TransferenciaConfirmada(id, temRessalva, ressalva);
    }

    /// @notice Lê os dados de uma transferência. Restrito a instituição autorizada.
    /// @param id Identificador da transferência.
    /// @return Transferencia Struct completa: origem, destino, lacre, estado, ressalva, timestamps.
    function consultar(uint256 id) external view apenasAutorizada returns (Transferencia memory) {
        return transferencias[id];
    }
}
