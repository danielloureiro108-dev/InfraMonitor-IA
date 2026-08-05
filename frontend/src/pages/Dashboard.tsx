import { useEffect, useState, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";
import { Server, Activity, AlertTriangle, Gauge, Filter, X } from "lucide-react";
import { api } from "../lib/api";
import { AppLayout } from "../components/layout/AppLayout";
import { Card, KpiCard } from "../components/ui/Card";
import { useRealtime } from "../hooks/useRealtime";
import { ResumoDashboard } from "../types";

interface PontoSerie {
  intervalo: string;
  disponibilidade: number;
  latencia_media: number;
}
interface PontoCategoria {
  categoria: string;
  total: number;
}
interface Empresa {
  id: string;
  nome: string;
}

// Cores dos gráficos lidas das mesmas variáveis CSS do tema (claro/escuro).
const corGrade = "rgb(var(--surface-border))";
const corEixo = "rgb(var(--foreground-subtle))";
const tooltipStyle = {
  background: "rgb(var(--surface-raised))",
  border: "1px solid rgb(var(--surface-border))",
  borderRadius: 8,
  fontSize: 12,
  color: "rgb(var(--foreground))",
};

export default function Dashboard() {
  const [resumo, setResumo] = useState<ResumoDashboard | null>(null);
  const [serie, setSerie] = useState<PontoSerie[]>([]);
  const [offlinePorCategoria, setOfflinePorCategoria] = useState<PontoCategoria[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [empresaId, setEmpresaId] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");

  useEffect(() => { api.get<Empresa[]>("/org/empresas").then(setEmpresas); }, []);

  const carregar = useCallback(async () => {
    const filtroBase = new URLSearchParams();
    if (empresaId) filtroBase.set("empresa_id", empresaId);

    const filtroSerie = new URLSearchParams(filtroBase);
    if (inicio && fim) {
      filtroSerie.set("inicio", inicio);
      filtroSerie.set("fim", fim);
    } else {
      filtroSerie.set("periodo", "24h");
    }

    const [r, s, c] = await Promise.all([
      api.get<ResumoDashboard>(`/dashboard/resumo?${filtroBase.toString()}`),
      api.get<PontoSerie[]>(`/dashboard/disponibilidade-serie?${filtroSerie.toString()}`),
      api.get<PontoCategoria[]>(`/dashboard/offline-por-categoria?${filtroBase.toString()}`),
    ]);
    setResumo(r);
    setSerie(s);
    setOfflinePorCategoria(c);
    setCarregando(false);
  }, [empresaId, inicio, fim]);

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 30000);
    return () => clearInterval(intervalo);
  }, [carregar]);

  // atualiza o resumo assim que qualquer equipamento muda de status em tempo real
  useRealtime((tipo) => {
    if (tipo === "status_equipamento") carregar();
  });

  function limparFiltros() {
    setEmpresaId("");
    setInicio("");
    setFim("");
  }

  const filtrosAtivos = !!(empresaId || (inicio && fim));

  return (
    <AppLayout titulo="Dashboard">
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Filter size={15} className="text-foreground-subtle" />
        <select className="input max-w-[220px]" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
          <option value="">Todos os clientes</option>
          {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
        </select>
        <input type="date" className="input max-w-[160px]" value={inicio} onChange={(e) => setInicio(e.target.value)} title="De" />
        <span className="text-foreground-subtle text-sm">até</span>
        <input type="date" className="input max-w-[160px]" value={fim} onChange={(e) => setFim(e.target.value)} title="Até" />
        {filtrosAtivos && (
          <button onClick={limparFiltros} className="btn-secondary !py-1.5">
            <X size={14} /> Limpar filtros
          </button>
        )}
      </div>

      {carregando || !resumo ? (
        <p className="text-foreground-subtle text-sm">Carregando…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard titulo="Total de equipamentos" valor={resumo.total} icone={<Server size={20} />} />
            <KpiCard titulo="Online" valor={resumo.online} icone={<Activity size={20} className="text-status-online" />} />
            <KpiCard titulo="Offline" valor={resumo.offline} icone={<Activity size={20} className="text-status-offline" />} />
            <KpiCard titulo="Instáveis" valor={resumo.instaveis} icone={<Activity size={20} className="text-status-unstable" />} />
            <KpiCard titulo="Alertas abertos" valor={resumo.alertas_abertos} icone={<AlertTriangle size={20} className="text-amber-400" />} />
            <KpiCard titulo="Disponibilidade 24h" valor={resumo.disponibilidade_24h_pct.toFixed(1)} sufixo="%" icone={<Gauge size={20} />} />
            <KpiCard titulo="Disponibilidade 7 dias" valor={resumo.disponibilidade_7d_pct.toFixed(1)} sufixo="%" icone={<Gauge size={20} />} />
            <KpiCard titulo="Latência média" valor={resumo.latencia_media_ms.toFixed(0)} sufixo="ms" icone={<Activity size={20} />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <h3 className="text-sm font-medium text-foreground mb-4">
                Disponibilidade &amp; latência {inicio && fim ? "— período selecionado" : "— últimas 24h"}
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" stroke={corGrade} />
                  <XAxis
                    dataKey="intervalo"
                    tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    stroke={corEixo} fontSize={11}
                  />
                  <YAxis stroke={corEixo} fontSize={11} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: "rgb(var(--foreground))" }}
                    labelFormatter={(v) => new Date(v).toLocaleString("pt-BR")}
                  />
                  <Line type="monotone" dataKey="disponibilidade" name="Disponibilidade (%)" stroke="#6366F1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="latencia_media" name="Latência média (ms)" stroke="#22C55E" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 className="text-sm font-medium text-foreground mb-4">Offline por categoria</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={offlinePorCategoria}>
                  <CartesianGrid strokeDasharray="3 3" stroke={corGrade} />
                  <XAxis dataKey="categoria" stroke={corEixo} fontSize={11} />
                  <YAxis stroke={corEixo} fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "rgb(var(--foreground))" }} />
                  <Bar dataKey="total" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <p className="text-xs text-foreground-subtle">
            Última atualização: {resumo.ultima_atualizacao ? new Date(resumo.ultima_atualizacao).toLocaleString("pt-BR") : "—"}
          </p>
        </div>
      )}
    </AppLayout>
  );
}
