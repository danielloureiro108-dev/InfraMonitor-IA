import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { api } from "../lib/api";
import { AppLayout } from "../components/layout/AppLayout";
import { Card } from "../components/ui/Card";
import { useRealtime } from "../hooks/useRealtime";
import { Alerta } from "../types";

const COR_SEVERIDADE: Record<Alerta["severidade"], string> = {
  baixa: "text-foreground-muted",
  media: "text-amber-400",
  alta: "text-orange-400",
  critica: "text-red-400",
};

export default function Alertas() {
  const [lista, setLista] = useState<Alerta[]>([]);
  const [status, setStatus] = useState("aberto");

  async function carregar() {
    setLista(await api.get<Alerta[]>(`/alertas${status ? `?status=${status}` : ""}`));
  }

  useEffect(() => { carregar(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  useRealtime((tipo) => { if (tipo === "status_equipamento") carregar(); });

  async function confirmar(id: string) {
    await api.post(`/alertas/${id}/confirmar`);
    carregar();
  }

  return (
    <AppLayout titulo="Alertas">
      <div className="flex gap-2 mb-4">
        {["aberto", "confirmado", "resolvido", ""].map((s) => (
          <button
            key={s || "todos"}
            onClick={() => setStatus(s)}
            className={status === s ? "btn-primary !py-1.5" : "btn-secondary !py-1.5"}
          >
            {s ? s[0].toUpperCase() + s.slice(1) : "Todos"}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {lista.map((a) => (
          <Card key={a.id} className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${COR_SEVERIDADE[a.severidade]}`}>
                {a.severidade} · {a.tipo}
              </p>
              <p className="text-sm text-foreground mt-1">{a.mensagem}</p>
              <p className="text-xs text-foreground-subtle mt-1">
                {a.equipamento_nome} ({a.equipamento_ip}) · {new Date(a.criado_em).toLocaleString("pt-BR")}
              </p>
            </div>
            {a.status === "aberto" && (
              <button onClick={() => confirmar(a.id)} className="btn-secondary shrink-0">
                <CheckCircle2 size={14} /> Confirmar
              </button>
            )}
            {a.status !== "aberto" && (
              <span className="text-xs text-foreground-subtle capitalize shrink-0">{a.status}</span>
            )}
          </Card>
        ))}
        {lista.length === 0 && <p className="text-foreground-subtle text-sm">Nenhum alerta encontrado para este filtro.</p>}
      </div>
    </AppLayout>
  );
}
