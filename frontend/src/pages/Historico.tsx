import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "../lib/api";
import { AppLayout } from "../components/layout/AppLayout";
import { Card } from "../components/ui/Card";
import { Equipamento, Empresa } from "../types";

interface RegistroPing {
  id: string;
  equipamento_id: string;
  online: boolean;
  tempo_ms: number | null;
  ttl: number | null;
  packet_loss_pct: number | null;
  jitter_ms: number | null;
  executado_em: string;
}

export default function Historico() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [equipamentoId, setEquipamentoId] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [status, setStatus] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [registros, setRegistros] = useState<RegistroPing[]>([]);

  useEffect(() => {
    api.get<Equipamento[]>("/equipamentos").then(setEquipamentos);
    api.get<Empresa[]>("/org/empresas").then(setEmpresas);
  }, []);

  async function carregar() {
    const params = new URLSearchParams({ limite: "300" });
    if (equipamentoId) params.set("equipamento_id", equipamentoId);
    if (empresaId) params.set("empresa_id", empresaId);
    if (status) params.set("status", status);
    if (inicio) params.set("inicio", inicio);
    if (fim) params.set("fim", fim);
    setRegistros(await api.get<RegistroPing[]>(`/historico/ping?${params.toString()}`));
  }

  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function limparFiltros() {
    setEquipamentoId(""); setEmpresaId(""); setStatus(""); setInicio(""); setFim("");
  }

  const nomePorId = Object.fromEntries(equipamentos.map((e) => [e.id, e.nome]));
  const filtrosAtivos = !!(equipamentoId || empresaId || status || inicio || fim);

  return (
    <AppLayout titulo="Histórico">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select className="input max-w-xs" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
          <option value="">Todos os clientes</option>
          {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
        </select>
        <select className="input max-w-xs" value={equipamentoId} onChange={(e) => setEquipamentoId(e.target.value)}>
          <option value="">Todos os equipamentos</option>
          {equipamentos.map((eq) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
        </select>
        <select className="input max-w-[160px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Online e offline</option>
          <option value="online">Somente online</option>
          <option value="offline">Somente offline</option>
        </select>
        <input type="date" className="input max-w-[160px]" value={inicio} onChange={(e) => setInicio(e.target.value)} title="De" />
        <span className="text-foreground-subtle text-sm">até</span>
        <input type="date" className="input max-w-[160px]" value={fim} onChange={(e) => setFim(e.target.value)} title="Até" />
        <button className="btn-secondary" onClick={carregar}>Filtrar</button>
        {filtrosAtivos && (
          <button className="btn-secondary" onClick={() => { limparFiltros(); setTimeout(carregar, 0); }}>
            <X size={14} /> Limpar
          </button>
        )}
      </div>

      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-foreground-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Quando</th>
              <th className="text-left px-4 py-3 font-medium">Equipamento</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Tempo</th>
              <th className="text-left px-4 py-3 font-medium">TTL</th>
              <th className="text-left px-4 py-3 font-medium">Packet Loss</th>
              <th className="text-left px-4 py-3 font-medium">Jitter</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {registros.map((r) => (
              <tr key={r.id} className="hover:bg-foreground/[0.02]">
                <td className="px-4 py-2.5 text-foreground-muted font-mono text-xs">{new Date(r.executado_em).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-2.5 text-foreground">{nomePorId[r.equipamento_id] || "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={r.online ? "text-status-online" : "text-status-offline"}>{r.online ? "Online" : "Offline"}</span>
                </td>
                <td className="px-4 py-2.5 font-mono">{r.tempo_ms ?? "—"} ms</td>
                <td className="px-4 py-2.5 font-mono">{r.ttl ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono">{r.packet_loss_pct ?? "—"}%</td>
                <td className="px-4 py-2.5 font-mono">{r.jitter_ms ?? "—"} ms</td>
              </tr>
            ))}
            {registros.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-foreground-subtle">Nenhum registro encontrado para os filtros selecionados.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </AppLayout>
  );
}
