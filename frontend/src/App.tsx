import { Route, Routes } from "react-router-dom";
import { Home } from "@/pages/home";
import { Auth } from "@/pages/auth";
import { Painel } from "@/pages/painel";
import { NovaTransferencia } from "@/pages/nova-transferencia";
import { TransferenciaDetalhe } from "@/pages/transferencia-detalhe";
import { BemHistorico } from "@/pages/bem-historico";
import { RegistrarItem } from "@/pages/registrar-item";
import { Reconciliacao } from "@/pages/reconciliacao";
import { DemoDeclinio } from "@/pages/demo-declinio";
import { AdminInstituicoes } from "@/pages/admin-instituicoes";
import { RemessasPendentes } from "@/pages/remessas-pendentes";
import { HistoricoTransferencias } from "@/pages/historico-transferencias";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/painel" element={<Painel />} />
      <Route path="/remessas" element={<RemessasPendentes />} />
      <Route path="/historico" element={<HistoricoTransferencias />} />
      <Route path="/bens/novo" element={<RegistrarItem />} />
      <Route path="/transferencias/nova" element={<NovaTransferencia />} />
      <Route path="/transferencias/:id" element={<TransferenciaDetalhe />} />
      <Route path="/bens/:itemId" element={<BemHistorico />} />
      <Route path="/reconciliacao" element={<Reconciliacao />} />
      <Route path="/demo/declinio-federal" element={<DemoDeclinio />} />
      <Route path="/admin/instituicoes" element={<AdminInstituicoes />} />
    </Routes>
  );
}
