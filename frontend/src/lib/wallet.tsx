import { BrowserProvider, type Eip1193Provider, type JsonRpcSigner } from "ethers";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

type EstadoWallet = {
  endereco: string | null;
  conectando: boolean;
  erro: string | null;
  conectar: () => Promise<void>;
  desconectar: () => void;
  obterSigner: () => Promise<JsonRpcSigner>;
};

const WalletContext = createContext<EstadoWallet | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [endereco, setEndereco] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!window.ethereum || !("on" in window.ethereum)) return;
    const eth = window.ethereum as Eip1193Provider & {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
    const onAccounts = (accounts: unknown) => {
      const lista = Array.isArray(accounts) ? (accounts as string[]) : [];
      setEndereco(lista[0] ?? null);
    };
    eth.on?.("accountsChanged", onAccounts);
    return () => eth.removeListener?.("accountsChanged", onAccounts);
  }, []);

  const conectar = useCallback(async () => {
    if (!window.ethereum) {
      setErro("Nenhuma wallet encontrada. Instale o MetaMask.");
      return;
    }
    setConectando(true);
    setErro(null);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const contas = await provider.send("eth_requestAccounts", []);
      setEndereco(contas[0] ?? null);
    } catch {
      setErro("Conexão recusada ou falhou.");
    } finally {
      setConectando(false);
    }
  }, []);

  const desconectar = useCallback(() => {
    setEndereco(null);
  }, []);

  const obterSigner = useCallback(async () => {
    if (!window.ethereum) throw new Error("Nenhuma wallet encontrada.");
    const provider = new BrowserProvider(window.ethereum);
    return provider.getSigner();
  }, []);

  const valor = useMemo(
    () => ({ endereco, conectando, erro, conectar, desconectar, obterSigner }),
    [endereco, conectando, erro, conectar, desconectar, obterSigner],
  );

  return <WalletContext.Provider value={valor}>{children}</WalletContext.Provider>;
}

export function useWallet(): EstadoWallet {
  const contexto = useContext(WalletContext);
  if (!contexto) throw new Error("useWallet precisa estar dentro de WalletProvider");
  return contexto;
}
