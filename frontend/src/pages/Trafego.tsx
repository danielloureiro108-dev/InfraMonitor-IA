import { useEffect, useState, ReactNode } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Sparkles, Loader2, Radio, Rss } from "lucide-react";
import { api } from "../lib/api";
import { AppLayout } from "../components/layout/AppLayout";
import { Card } from "../components/ui/Card";
import { useAuth } from "../lib/auth";
import { ResumoTrafego, ConfigColetor, FluxoTrafego } from "../types";

const PERIODOS = [
  { valor: "1h", rotulo: "1 hora" },
  { valor: "6h", rotulo: "6 horas" },
  { valor: "24h", rotulo: "24 horas" },
  { valor: "7d", rotulo: "7 dias" },
];

function formatarBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function Trafego() {
  const { usuario } = useAuth();
  const podeConfigurar = usuario?.perfil === "administrador" || usuario?.perfil === "operador";

  const [periodo, setPeriodo] = useState("24h");
  const [resumo, setResumo] = useState<ResumoTrafego | null>(null);
  const [flows, setFlows] = useState<FluxoTrafego[]>([]);
  const [config, setConfig] = useState<{ netflow: ConfigColetor; syslog: ConfigColetor } | null>(null);
  const [insights, setInsights] = useState<{ fonte: string; insights: string[] } | null>(null);
  const [gerandoInsights, setGerandoInsights] = useState(false);

  async function carregar() {
    const [r, f, c] = await Promise.all([
      api.get<ResumoTrafego>(`/trafego/resumo?periodo=${periodo}`),
      api.get<FluxoTrafego[]>(`/trafego/flows?periodo=${periodo}&limite=50`),
      api.get<{ netflow: ConfigColetor; syslog: ConfigColetor }>("/trafego/config"),
    ]);
    setResumo(r);
    setFlows(f);
    setConfig(c);
  }

  useEffect(() => { carregar(); }, [periodo]); // eslint-disable-line react-hooks/exhaustive-deps

  async function salvarConfig(tipo: "netflow" | "syslog", ativo: boolean, porta: number) {
    const atualizado = await api.put<{ netflow: any; syslog: any }>("/trafego/config", { [tipo]: { ativo, porta } });
    setConfig((c) => (c ? { ...c, [tipo]: { ativo, porta, rodando: atualizado[tipo].ativo } } : c));
  }

  async function gerarInsights() {
    setGerandoInsights(true);
    try {
      setInsights(await api.get<{ fonte: string; insights: string[] }>(`/trafego/insights?periodo=${periodo}`));
    } finally {
      setGerandoInsights(false);
    }
  }

  return (
    <AppLayout titulo="Tráfego (NetFlow / Syslog)">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {config && (
          <>
            <ColetorCard
              icone={<Radio size={16} />}
              titulo="NetFlow v5"
              descricao="Receba exports de NetFlow v5 dos seus roteadores/firewalls para ver tráfego por IP e aplicação."
              config={config.netflow}
              podeConfigurar={podeConfigurar}
              onSalvar={(ativo, porta) => salvarConfig("netflow", ativo, porta)}
            />
            <ColetorCard
              icone={<Rss size={16} />}
              titulo="Syslog"
              descricao="Receba logs de firewalls (ex: iptables, pfSense) via Syslog UDP. Extrai IP/porta quando o formato permite."
              config={config.syslog}
              podeConfigurar={podeConfigurar}
              onSalvar={(ativo, porta) => salvarConfig("syslog", ativo, porta)}
            />
          </>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        {PERIODOS.map((p) => (
          <button key={p.valor} onClick={() => setPeriodo(p.valor)} className={periodo === p.valor ? "btn-primary !py-1.5" : "btn-secondary !py-1.5"}>
            {p.rotulo}
          </button>
        ))}
      </div>

      {resumo && (
        <>
          <Card className="mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-foreground">Volume de tráfego no período</h3>
              <span className="text-xs text-foreground-subtle">Total: {formatarBytes(resumo.totalBytes)}</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={resumo.serieTempo}>
                <defs>
                  <linearGradient id="corVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--surface-border))" />
                <XAxis dataKey="quando" tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} stroke="rgb(var(--foreground-subtle))" fontSize={11} />
                <YAxis stroke="rgb(var(--foreground-subtle))" fontSize={11} tickFormatter={(v) => formatarBytes(v)} />
                <Tooltip
                  contentStyle={{ background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--surface-border))", borderRadius: 8, fontSize: 12, color: "rgb(var(--foreground))" }}
                  labelStyle={{ color: "rgb(var(--foreground))" }}
                  labelFormatter={(v) => new Date(v).toLocaleString("pt-BR")}
                  formatter={(v: any) => [formatarBytes(Number(v)), "Volume"]}
                />
                <Area type="monotone" dataKey="bytes" stroke="#6366F1" fill="url(#corVolume)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card>
              <h3 className="text-sm font-medium text-foreground mb-4">Top IPs por volume</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={resumo.topIps} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--surface-border))" />
                  <XAxis type="number" stroke="rgb(var(--foreground-subtle))" fontSize={11} tickFormatter={(v) => formatarBytes(v)} />
                  <YAxis type="category" dataKey="chave" stroke="rgb(var(--foreground-subtle))" fontSize={11} width={110} />
                  <Tooltip
                    contentStyle={{ background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--surface-border))", borderRadius: 8, fontSize: 12, color: "rgb(var(--foreground))" }}
                    formatter={(v: any) => [formatarBytes(Number(v)), "Volume"]}
                  />
                  <Bar dataKey="bytes" fill="#6366F1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 className="text-sm font-medium text-foreground mb-4">Top aplicações por volume</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={resumo.topAplicacoes} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--surface-border))" />
                  <XAxis type="number" stroke="rgb(var(--foreground-subtle))" fontSize={11} tickFormatter={(v) => formatarBytes(v)} />
                  <YAxis type="category" dataKey="chave" stroke="rgb(var(--foreground-subtle))" fontSize={11} width={110} />
                  <Tooltip
                    contentStyle={{ background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--surface-border))", borderRadius: 8, fontSize: 12, color: "rgb(var(--foreground))" }}
                    formatter={(v: any) => [formatarBytes(Number(v)), "Volume"]}
                  />
                  <Bar dataKey="bytes" fill="#22C55E" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Sparkles size={16} className="text-brand" /> Sugestões inteligentes
              </h3>
              <button onClick={gerarInsights} className="btn-secondary !py-1.5" disabled={gerandoInsights}>
                {gerandoInsights ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {gerandoInsights ? "Analisando…" : "Gerar sugestões"}
              </button>
            </div>
            {insights ? (
              <>
                <ul className="space-y-2 text-sm text-foreground">
                  {insights.insights.map((texto, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-brand">•</span> {texto}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-foreground-subtle mt-3">
                  {insights.fonte === "ia" ? "Gerado com IA (Claude)." : "Gerado por heurísticas locais — configure ANTHROPIC_API_KEY no .env para análises mais elaboradas com IA."}
                </p>
              </>
            ) : (
              <p className="text-xs text-foreground-subtle">Clique em "Gerar sugestões" para uma análise do tráfego do período selecionado.</p>
            )}
          </Card>

          <Card className="!p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-border text-sm font-medium text-foreground">Fluxos recentes</div>
            <table className="w-full text-sm">
              <thead className="bg-foreground/[0.03] text-foreground-muted text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Quando</th>
                  <th className="text-left px-4 py-2 font-medium">Origem</th>
                  <th className="text-left px-4 py-2 font-medium">Destino</th>
                  <th className="text-left px-4 py-2 font-medium">Aplicação</th>
                  <th className="text-left px-4 py-2 font-medium">Protocolo</th>
                  <th className="text-left px-4 py-2 font-medium">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {flows.map((f) => (
                  <tr key={f.id}>
                    <td className="px-4 py-2 text-foreground-muted font-mono text-xs">{new Date(f.capturado_em).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-2 font-mono">{f.ip_origem}{f.porta_origem ? `:${f.porta_origem}` : ""}</td>
                    <td className="px-4 py-2 font-mono">{f.ip_destino}{f.porta_destino ? `:${f.porta_destino}` : ""}</td>
                    <td className="px-4 py-2">{f.aplicacao || "—"}</td>
                    <td className="px-4 py-2">{f.protocolo || "—"}</td>
                    <td className="px-4 py-2 font-mono">{formatarBytes(f.bytes)}</td>
                  </tr>
                ))}
                {flows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-foreground-subtle">Nenhum fluxo capturado ainda neste período. Ative o NetFlow ou o Syslog acima e aponte seus dispositivos para este servidor.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </AppLayout>
  );
}

function ColetorCard({
  icone, titulo, descricao, config, podeConfigurar, onSalvar,
}: {
  icone: ReactNode; titulo: string; descricao: string; config: ConfigColetor;
  podeConfigurar: boolean; onSalvar: (ativo: boolean, porta: number) => void;
}) {
  const [porta, setPorta] = useState(config.porta);

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">{icone} {titulo}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${config.rodando ? "bg-status-online/15 text-status-online" : "bg-foreground/10 text-foreground-subtle"}`}>
          {config.rodando ? "Ativo" : "Inativo"}
        </span>
      </div>
      <p className="text-xs text-foreground-subtle mb-3">{descricao}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="input max-w-[110px] !py-1.5"
          value={porta}
          onChange={(e) => setPorta(Number(e.target.value))}
          disabled={!podeConfigurar}
        />
        <span className="text-xs text-foreground-subtle">porta UDP</span>
        {podeConfigurar && (
          <button className="btn-secondary !py-1.5 ml-auto" onClick={() => onSalvar(!config.rodando, porta)}>
            {config.rodando ? "Desativar" : "Ativar"}
          </button>
        )}
      </div>
    </Card>
  );
}
