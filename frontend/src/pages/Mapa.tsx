import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { api } from "../lib/api";
import { AppLayout } from "../components/layout/AppLayout";
import { useRealtime } from "../hooks/useRealtime";
import { Equipamento, StatusEquipamento, Empresa } from "../types";

const BORDA_POR_STATUS: Record<StatusEquipamento, string> = {
  online: "border-l-status-online",
  offline: "border-l-status-offline",
  instavel: "border-l-status-unstable",
  desconhecido: "border-l-status-unknown",
};

export default function Mapa() {
  const [lista, setLista] = useState<Equipamento[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState("");

  async function carregar() {
    const params = empresaId ? `?empresa_id=${empresaId}` : "";
    setLista(await api.get<Equipamento[]>(`/equipamentos${params}`));
  }

  useEffect(() => { api.get<Empresa[]>("/org/empresas").then(setEmpresas); }, []);
  useEffect(() => { carregar(); }, [empresaId]); // eslint-disable-line react-hooks/exhaustive-deps
  useRealtime((tipo) => { if (tipo === "status_equipamento") carregar(); });

  // Quando "Todos os clientes" está selecionado, agrupa os cards por Cliente
  // para deixar claro de qual cliente é cada device.
  const grupos = useMemo(() => {
    const mapa = new Map<string, Equipamento[]>();
    lista.forEach((eq) => {
      const chave = eq.empresa_nome || "Sem cliente definido";
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(eq);
    });
    return Array.from(mapa.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [lista]);

  return (
    <AppLayout titulo="Mapa de Equipamentos">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-4 text-xs text-foreground-muted">
          <Legenda cor="bg-status-online" rotulo="Online" />
          <Legenda cor="bg-status-offline" rotulo="Offline" />
          <Legenda cor="bg-status-unstable" rotulo="Instável" />
          <Legenda cor="bg-status-unknown" rotulo="Desconhecido" />
        </div>
        <select className="input max-w-[220px]" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
          <option value="">Todos os clientes</option>
          {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
        </select>
      </div>

      {empresaId ? (
        <Grade equipamentos={lista} />
      ) : (
        <div className="space-y-6">
          {grupos.map(([nomeCliente, equipamentosDoCliente]) => (
            <div key={nomeCliente}>
              <h3 className="text-sm font-semibold text-foreground-muted mb-2 uppercase tracking-wide">{nomeCliente}</h3>
              <Grade equipamentos={equipamentosDoCliente} />
            </div>
          ))}
        </div>
      )}

      {lista.length === 0 && <p className="text-foreground-subtle text-sm">Nenhum equipamento cadastrado ainda.</p>}
    </AppLayout>
  );
}

function Grade({ equipamentos }: { equipamentos: Equipamento[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
      {equipamentos.map((eq) => (
        <Link
          key={eq.id}
          to={`/equipamentos/${eq.id}`}
          className={clsx("card border-l-4 hover:border-brand transition-colors", BORDA_POR_STATUS[eq.status])}
        >
          <p className="font-medium text-foreground text-sm truncate">{eq.nome}</p>
          <p className="text-xs text-foreground-subtle font-mono">{eq.ip}</p>
          <p className="text-xs text-foreground-subtle mt-1">{eq.categoria_nome || eq.tipo}</p>
        </Link>
      ))}
    </div>
  );
}

function Legenda({ cor, rotulo }: { cor: string; rotulo: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={clsx("w-2.5 h-2.5 rounded-full", cor)} /> {rotulo}
    </span>
  );
}
