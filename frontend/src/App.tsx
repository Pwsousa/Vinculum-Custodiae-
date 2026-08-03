import { Route, Routes } from "react-router-dom";
import { Home } from "@/pages/home";
import { Auth } from "@/pages/auth";
import { Painel } from "@/pages/painel";
import { NovaTransferencia } from "@/pages/nova-transferencia";
import { TransferenciaDetalhe } from "@/pages/transferencia-detalhe";
import { BemHistorico } from "@/pages/bem-historico";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/painel" element={<Painel />} />
      <Route path="/transferencias/nova" element={<NovaTransferencia />} />
      <Route path="/transferencias/:id" element={<TransferenciaDetalhe />} />
      <Route path="/bens/:itemId" element={<BemHistorico />} />
    </Routes>
  );
}
