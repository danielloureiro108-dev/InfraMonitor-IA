import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScanSearch, Loader2, Plus } from "lucide-react";
import { api } from "../lib/api";
import { AppLayout } from "../components/layout/AppLayout";
import { Card } from "../components/ui/Card";

interface Encontrado { ip: string; tempoMs: number | null; ttl: number | null }

export default function Descoberta() {
  const navigate = useNavigate();
  const [rede, setRede] = useState("192.168.0.0/24");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<{ total_ips_verificados: number; dispositivos_encontrados: Encontrado[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function escanear(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setBuscando(true);
    setResultado(null);
    try {
      const r = await api.post<typeof resultado>("/discovery/scan", { rede });
      setResultado(r);
    } catch (e: any) {
      setErro(e.message || "Falha ao escanear a rede");
    } finally {
      setBuscando(false);
    }
  }

  function adicionarAoInventario(ip: string) {
    navigate(`/equipamentos/novo?ip=${encodeURIComponent(ip)}`);
  }

  return (
    <AppLayout titulo="Descoberta Automática">
      <Card className="max-w-xl mb-6">
        <form onSubmit={escanear} className="space-y-4">
          <div>
            <label className="label">Rede (CIDR)</label>
            <input className="input font-mono" value={rede} onChange={(e) => setRede(e.target.value)} placeholder="192.168.0.0/24" />
            <p className="text-xs text-foreground-subtle mt-1">Suporta redes /22 ou menores. A varredura executa ping ICMP real em cada host.</p>
          </div>
          {erro && <p className="text-sm text-red-400">{erro}</p>}
          <button type="submit" className="btn-primary" disabled={buscando}>
            {buscando ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />}
            {buscando ? "Escaneando…" : "Escanear rede"}
          </button>
        </form>
      </Card>

      {resultado && (
        <Card className="!p-0 overflow-hidden max-w-2xl">
          <div className="px-4 py-3 border-b border-surface-border text-sm text-foreground-muted">
            {resultado.dispositivos_encontrados.length} dispositivo(s) responderam de {resultado.total_ips_verificados} IPs verificados
          </div>
          <table className="w-full text-sm">
            <thead className="bg-foreground/[0.03] text-foreground-muted text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">IP</th>
                <th className="text-left px-4 py-2 font-medium">Tempo</th>
                <th className="text-left px-4 py-2 font-medium">TTL</th>
                <th className="text-right px-4 py-2 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {resultado.dispositivos_encontrados.map((d) => (
                <tr key={d.ip}>
                  <td className="px-4 py-2 font-mono">{d.ip}</td>
                  <td className="px-4 py-2 font-mono">{d.tempoMs ?? "—"} ms</td>
                  <td className="px-4 py-2 font-mono">{d.ttl ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => adicionarAoInventario(d.ip)} className="btn-secondary !py-1.5">
                      <Plus size={14} /> Adicionar ao inventário
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppLayout>
  );
}
