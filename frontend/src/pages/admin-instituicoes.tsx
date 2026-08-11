import { useCallback, useEffect, useState } from "react";
import { getAddress, isAddress } from "ethers";
import { AppShell } from "@/components/app-shell";
import { SectionTitle, Hash } from "@/lib/custody-ui";
import { useWallet } from "@/lib/wallet";
import { criarContratoCustodia, obterEnderecoContrato } from "@/lib/contrato";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type InstituicaoLista = {
  id: string;
  sigla: string;
  threshold: number;
  ativa: boolean;
  totalSignatarios: number;
};

export function AdminInstituicoes() {
  const { endereco, obterSigner } = useWallet();

  const [owner, setOwner] = useState("");
  const [lista, setLista] = useState<InstituicaoLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState("");

  const [sigla, setSigla] = useState("");
  const [threshold, setThreshold] = useState("1");
  const [enviandoInst, setEnviandoInst] = useState(false);
  const [erroInst, setErroInst] = useState("");
  const [okInst, setOkInst] = useState("");

  const [institutionId, setInstitutionId] = useState("");
  const [signatario, setSignatario] = useState("");
  const [enviandoSig, setEnviandoSig] = useState(false);
  const [erroSig, setErroSig] = useState("");
  const [okSig, setOkSig] = useState("");

  const ehOwner =
    !!endereco && !!owner && endereco.toLowerCase() === owner.toLowerCase();

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga("");
    try {
      const signer = await obterSigner();
      const contrato = criarContratoCustodia(signer);
      const [ownerOnChain, proxima] = await Promise.all([
        contrato.owner() as Promise<string>,
        contrato.proximaInstituicaoId() as Promise<bigint>,
      ]);
      setOwner(ownerOnChain);

      const itens: InstituicaoLista[] = [];
      const ultimoId = Number(proxima) - 1;
      for (let id = 1; id <= ultimoId; id++) {
        const [inst, total] = await Promise.all([
          contrato.instituicoes(id),
          contrato.totalSignatarios(id),
        ]);
        const siglaLida = String(inst.sigla ?? "");
        if (!siglaLida) continue;
        itens.push({
          id: String(id),
          sigla: siglaLida,
          threshold: Number(inst.threshold),
          ativa: Boolean(inst.ativa),
          totalSignatarios: Number(total),
        });
      }
      setLista(itens);
    } catch (e) {
      setErroCarga(e instanceof Error ? e.message : "Falha ao carregar instituições.");
      setLista([]);
    } finally {
      setCarregando(false);
    }
  }, [obterSigner]);

  useEffect(() => {
    void carregar();
  }, [carregar, endereco]);

  async function cadastrarInstituicao(e: React.FormEvent) {
    e.preventDefault();
    setErroInst("");
    setOkInst("");
    const limiar = Number(threshold);
    if (!sigla.trim() || !Number.isInteger(limiar) || limiar < 1) {
      setErroInst("Informe a sigla e um threshold ≥ 1.");
      return;
    }
    setEnviandoInst(true);
    try {
      const signer = await obterSigner();
      const contrato = criarContratoCustodia(signer);
      const tx = await contrato.cadastrarInstituicao(sigla.trim().toUpperCase(), limiar);
      await tx.wait();
      const proxima = await contrato.proximaInstituicaoId();
      const idCriado = String(proxima - 1n);
      setOkInst(`Instituição ${sigla.trim().toUpperCase()} criada com ID ${idCriado}.`);
      setSigla("");
      setThreshold("1");
      await carregar();
    } catch (e) {
      setErroInst(traduzir(e));
    } finally {
      setEnviandoInst(false);
    }
  }

  async function autorizarSignatario(e: React.FormEvent) {
    e.preventDefault();
    setErroSig("");
    setOkSig("");
    if (!institutionId.trim() || !signatario.trim()) {
      setErroSig("Informe o ID da instituição e o endereço do signatário.");
      return;
    }
    if (!isAddress(signatario.trim())) {
      setErroSig("Endereço Ethereum inválido.");
      return;
    }
    setEnviandoSig(true);
    try {
      const enderecoNorm = getAddress(signatario.trim());
      const signer = await obterSigner();
      const contrato = criarContratoCustodia(signer);
      const tx = await contrato.adicionarSignatario(BigInt(institutionId.trim()), enderecoNorm);
      await tx.wait();
      setOkSig(`Endereço ${enderecoNorm} autorizado na instituição ${institutionId.trim()}.`);
      setSignatario("");
      await carregar();
    } catch (e) {
      setErroSig(traduzir(e));
    } finally {
      setEnviandoSig(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <p className="rule-label">Administração on-chain</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Instituições e signatários</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Só o <strong className="text-foreground">owner</strong> do contrato pode cadastrar. Em
          Hardhat local, use a Account #0.
        </p>
      </div>

      <div className="mb-6 rounded-md border border-border bg-card p-4 text-sm">
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="rule-label">Contrato</dt>
            <dd className="mt-0.5">
              <Hash value={obterEnderecoContrato()} chars={10} />
            </dd>
          </div>
          <div>
            <dt className="rule-label">Owner on-chain</dt>
            <dd className="mt-0.5">{owner ? <Hash value={owner} chars={10} /> : "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="rule-label">Sua wallet</dt>
            <dd className="mt-0.5 flex flex-wrap items-center gap-2">
              {endereco ? <Hash value={endereco} chars={10} /> : "não conectada"}
              {endereco ? (
                <span className={ehOwner ? "text-success" : "text-destructive"}>
                  {ehOwner ? "· você é o owner" : "· você não é o owner"}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </div>

      {!ehOwner ? (
        <p className="mb-6 rounded-md border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Conecte a Account #0 (owner) no MetaMask e recarregue esta página para cadastrar.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={cadastrarInstituicao}
          className="rounded-md border border-border bg-card p-5"
        >
          <SectionTitle
            title="Cadastrar instituição"
            hint="O ID é sequencial (1, 2, 3…). Threshold 1 = uma assinatura basta."
          />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sigla">Sigla</Label>
              <Input
                id="sigla"
                placeholder="POLICIA"
                value={sigla}
                onChange={(e) => setSigla(e.target.value)}
                disabled={!ehOwner || enviandoInst}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="threshold">Threshold (mín. de assinaturas)</Label>
              <Input
                id="threshold"
                type="number"
                min={1}
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                disabled={!ehOwner || enviandoInst}
              />
            </div>
            {erroInst ? <p className="text-sm text-destructive">{erroInst}</p> : null}
            {okInst ? <p className="text-sm text-success">{okInst}</p> : null}
            <Button type="submit" disabled={!ehOwner || enviandoInst}>
              {enviandoInst ? "Confirmando…" : "Cadastrar instituição"}
            </Button>
          </div>
        </form>

        <form
          onSubmit={autorizarSignatario}
          className="rounded-md border border-border bg-card p-5"
        >
          <SectionTitle
            title="Autorizar signatário"
            hint="Cole o endereço da conta MetaMask da instituição (ex.: Account #1 da Polícia)."
          />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="inst-id">ID da instituição</Label>
              <Input
                id="inst-id"
                placeholder="1"
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
                disabled={!ehOwner || enviandoSig}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signatario">Endereço do signatário</Label>
              <Input
                id="signatario"
                placeholder="0x7099…"
                value={signatario}
                onChange={(e) => setSignatario(e.target.value)}
                disabled={!ehOwner || enviandoSig}
              />
            </div>
            {erroSig ? <p className="text-sm text-destructive">{erroSig}</p> : null}
            {okSig ? <p className="text-sm text-success">{okSig}</p> : null}
            <Button type="submit" disabled={!ehOwner || enviandoSig}>
              {enviandoSig ? "Confirmando…" : "Autorizar endereço"}
            </Button>
          </div>
        </form>
      </div>

      <section className="mt-8 rounded-md border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title="Instituições cadastradas" />
          <Button type="button" size="sm" variant="outline" onClick={() => void carregar()}>
            Atualizar
          </Button>
        </div>
        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : erroCarga ? (
          <p className="text-sm text-destructive">{erroCarga}</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma instituição cadastrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Sigla</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Signatários</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell>{inst.id}</TableCell>
                  <TableCell className="font-medium">{inst.sigla}</TableCell>
                  <TableCell>{inst.threshold}</TableCell>
                  <TableCell>{inst.totalSignatarios}</TableCell>
                  <TableCell>{inst.ativa ? "Ativa" : "Inativa"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </AppShell>
  );
}

function traduzir(erro: unknown): string {
  const msg = erro instanceof Error ? erro.message : String(erro);
  if (
    msg.includes("apenas owner") ||
    msg.includes("apenasOwner") ||
    msg.includes("caller is not the owner")
  ) {
    return "Só o owner do contrato pode executar esta ação. Conecte a Account #0.";
  }
  if (msg.includes("threshold invalido")) return "Threshold inválido.";
  if (msg.includes("instituicao inexistente")) return "Instituição inexistente ou inativa.";
  if (msg.includes("ja e signatario")) return "Esse endereço já é signatário dessa instituição.";
  if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED")) {
    return "Transação rejeitada no MetaMask.";
  }
  return msg;
}
