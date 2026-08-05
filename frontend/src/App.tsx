import { ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";

import Login from "./pages/Login";
import OAuthCallback from "./pages/OAuthCallback";
import Dashboard from "./pages/Dashboard";
import Equipamentos from "./pages/Equipamentos";
import EquipamentoForm from "./pages/EquipamentoForm";
import EquipamentoDetalhe from "./pages/EquipamentoDetalhe";
import Mapa from "./pages/Mapa";
import Historico from "./pages/Historico";
import Alertas from "./pages/Alertas";
import Relatorios from "./pages/Relatorios";
import Descoberta from "./pages/Descoberta";
import Configuracoes from "./pages/Configuracoes";

function RotaProtegida({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useAuth();
  if (carregando) return null;
  if (!usuario) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/oauth-callback" element={<OAuthCallback />} />

      <Route path="/" element={<RotaProtegida><Dashboard /></RotaProtegida>} />
      <Route path="/equipamentos" element={<RotaProtegida><Equipamentos /></RotaProtegida>} />
      <Route path="/equipamentos/novo" element={<RotaProtegida><EquipamentoForm /></RotaProtegida>} />
      <Route path="/equipamentos/:id/editar" element={<RotaProtegida><EquipamentoForm /></RotaProtegida>} />
      <Route path="/equipamentos/:id" element={<RotaProtegida><EquipamentoDetalhe /></RotaProtegida>} />
      <Route path="/mapa" element={<RotaProtegida><Mapa /></RotaProtegida>} />
      <Route path="/historico" element={<RotaProtegida><Historico /></RotaProtegida>} />
      <Route path="/alertas" element={<RotaProtegida><Alertas /></RotaProtegida>} />
      <Route path="/relatorios" element={<RotaProtegida><Relatorios /></RotaProtegida>} />
      <Route path="/descoberta" element={<RotaProtegida><Descoberta /></RotaProtegida>} />
      <Route path="/configuracoes" element={<RotaProtegida><Configuracoes /></RotaProtegida>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
