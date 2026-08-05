import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
import { api } from "../lib/api";
import { AppLayout } from "../components/layout/AppLayout";
import { Card } from "../components/ui/Card";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useAuth } from "../lib/auth";
import { Equipamento, Empresa } from "../types";

export default function Equipamentos() {
  const { usuario } = useAuth();
  const [lista, setLista] = useState<Equipamento[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    const params = new URLSearchParams();
    if (busca) params.set("busca", busca);
    if (status) params.set("status", status);
    if (empresaId) params.set("empresa_id", empresaId);
    const dados = await api.get<Equipamento[]>(`/equipamentos?${params.toString()}`);
    setLista(dados);
    setCarregando(false);
  }

  useEffect(() => { api.get<Empresa[]>("/org/empresas").then(setEmpresas); }, []);
  useEffect(() => { carregar(); }, [empresaId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function excluir(id: string) {
    if (!confirm("Excluir este equipamento e todo o seu histórico? Essa ação não pode ser desfeita.")) return;
    await api.delete(`/equipamentos/${id}`);
    carregar();
  }

  const podeEditar = usuario?.perfil === "administrador" || usuario?.perfil === "operador";

  return (
    <AppLayout titulo="Equipamentos">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle" />
            <input
              className="input pl-9"
              placeholder="Buscar por nome, IP ou hostname"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && carregar()}
            />
          </div>
          <select className="input max-w-[200px]" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
            <option value="">Todos os clientes</option>
            {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
          </select>
          <select className="input max-w-[160px]" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="instavel">Instável</option>
            <option value="desconhecido">Desconhecido</option>
          </select>
          <button className="btn-secondary" onClick={carregar}>Filtrar</button>
        </div>

        {podeEditar && (
          <Link to="/equipamentos/novo" className="btn-primary">
            <Plus size={16} /> Novo equipamento
          </Link>
        )}
      </div>

      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-foreground-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Nome</th>
              <th className="text-left px-4 py-3 font-medium">Cliente</th>
              <th className="text-left px-4 py-3 font-medium">IP</th>
              <th className="text-left px-4 py-3 font-medium">Categoria</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {lista.map((eq) => (
              <tr key={eq.id} className="hover:bg-foreground/[0.02]">
                <td className="px-4 py-3">
                  <Link to={`/equipamentos/${eq.id}`} className="font-medium text-foreground hover:text-brand">
                    {eq.nome}
                  </Link>
                  <p className="text-xs text-foreground-subtle">{eq.hostname}</p>
                </td>
                <td className="px-4 py-3 text-foreground-muted">{eq.empresa_nome || "—"}</td>
                <td className="px-4 py-3 font-mono text-foreground">{eq.ip}</td>
                <td className="px-4 py-3 text-foreground-muted">{eq.categoria_nome || eq.tipo || "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={eq.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {podeEditar && (
                      <Link to={`/equipamentos/${eq.id}/editar`} className="btn-secondary !px-2 !py-1.5" title="Editar">
                        <Pencil size={14} />
                      </Link>
                    )}
                    {usuario?.perfil === "administrador" && (
                      <button onClick={() => excluir(eq.id)} className="btn-secondary !px-2 !py-1.5 hover:!border-red-500" title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!carregando && lista.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-foreground-subtle">
                  Nenhum equipamento cadastrado ainda. Clique em "Novo equipamento" para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </AppLayout>
  );
}
