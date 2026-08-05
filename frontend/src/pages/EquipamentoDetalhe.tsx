import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { AppLayout } from "../components/layout/AppLayout";
import { Card } from "../components/ui/Card";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Equipamento, FluxoTrafego } from "../types";

interface PingRegistro {
  online: boolean;
  tempo_ms: number | null;
  ttl: number | null;
  packet_loss_pct: number | null;
  jitter_ms: number | null;
  executado_em: string;
}
interface SnmpRegistro {
  hostname: string | null;
  descricao: string | null;
  uptime_seconds: number | null;
  cpu_pct: number | null;
  memoria_pct: number | null;
  executado_em: string;
}

export default function EquipamentoDetalhe() {
  const { id } = useParams();
  const [equipamento, setEquipamento] = useState<Equipamento | null>(null);
  const [historicoPing, setHistoricoPing] = useState<PingRegistro[]>([]);
  const [historicoSnmp, setHistoricoSnmp] = useState<SnmpRegistro[]>([]);

  useEffect(() => {
    if (!id) return;
    api.get<Equipamento>(`/equipamentos/${id}`).then(setEquipamento);
    api.get<PingRegistro[]>(`/historico/ping?equipamento_id=${id}&limite=100`).then((r) => setHistoricoPing(r.reverse()));
    api.get<SnmpRegistro[]>(`/historico/snmp?equipamento_id=${id}&limite=1`).then(setHistoricoSnmp);
  }, [id]);

  if (!equipamento) {
    return <AppLayout titulo="Equipamento"><p className="text-foreground-subtle text-sm">Carregando…</p></AppLayout>;
  }

  const ultimoPing = historicoPing[historicoPing.length - 1];
  const ultimoSnmp = historicoSnmp[0];
  const totalAmostras = historicoPing.length;
  const amostrasOnline = historicoPing.filter((h) => h.online).length;
  const disponibilidade = totalAmostras ? ((amostrasOnline / totalAmostras) * 100).toFixed(1) : "—";

  return (
    <AppLayout titulo={equipamento.nome}>
      <Link to="/equipamentos" className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground mb-4">
        <ArrowLeft size={14} /> Voltar para equipamentos
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card>
          <p className="text-xs text-foreground-muted uppercase tracking-wide mb-2">Status atual</p>
          <StatusBadge status={equipamento.status} />
          <p className="text-xs text-foreground-subtle mt-3">IP: <span className="font-mono text-foreground">{equipamento.ip}</span></p>
          <p className="text-xs text-foreground-subtle">Hostname: {equipamento.hostname || "—"}</p>
        </Card>
        <Card>
          <p className="text-xs text-foreground-muted uppercase tracking-wide mb-2">Último ping</p>
          <p className="text-sm text-foreground">{ultimoPing ? `${ultimoPing.tempo_ms ?? "—"} ms · TTL ${ultimoPing.ttl ?? "—"}` : "Sem dados ainda"}</p>
          <p className="text-xs text-foreground-subtle mt-1">{ultimoPing && new Date(ultimoPing.executado_em).toLocaleString("pt-BR")}</p>
        </Card>
        <Card>
          <p className="text-xs text-foreground-muted uppercase tracking-wide mb-2">Disponibilidade (amostra atual)</p>
          <p className="text-2xl font-mono text-foreground">{disponibilidade}{totalAmostras ? "%" : ""}</p>
          <p className="text-xs text-foreground-subtle mt-1">{totalAmostras} verificações consideradas</p>
        </Card>
      </div>

      <Card className="mb-4">
        <h3 className="text-sm font-medium text-foreground mb-4">Latência recente</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={historicoPing}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--surface-border))" />
            <XAxis dataKey="executado_em" tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} stroke="rgb(var(--foreground-subtle))" fontSize={11} />
            <YAxis stroke="rgb(var(--foreground-subtle))" fontSize={11} />
            <Tooltip
              contentStyle={{ background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--surface-border))", borderRadius: 8, fontSize: 12, color: "rgb(var(--foreground))" }}
              labelStyle={{ color: "rgb(var(--foreground))" }}
              labelFormatter={(v) => new Date(v).toLocaleString("pt-BR")}
            />
            <Line type="monotone" dataKey="tempo_ms" name="Latência (ms)" stroke="#6366F1" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {equipamento.tipo_monitoramento === "snmp" && <TrafegoInterfaceCard equipamentoId={equipamento.id} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <h3 className="text-sm font-medium text-foreground mb-3">Informações do cadastro</h3>
          <dl className="text-sm space-y-2">
            <Linha rotulo="Cliente" valor={equipamento.empresa_nome} />
            <Linha rotulo="Unidade" valor={equipamento.unidade_nome} />
            <Linha rotulo="Fabricante" valor={equipamento.fabricante} />
            <Linha rotulo="Modelo" valor={equipamento.modelo} />
            <Linha rotulo="Sistema Operacional" valor={equipamento.sistema_operacional} />
            <Linha rotulo="Responsável" valor={equipamento.responsavel} />
            <Linha rotulo="Localização" valor={equipamento.localizacao} />
            <Linha rotulo="Patrimônio" valor={equipamento.patrimonio} />
            <Linha rotulo="RustDesk ID" valor={equipamento.rustdesk_id} />
            <Linha rotulo="Tipo de monitoramento" valor={equipamento.tipo_monitoramento === "snmp" ? "SNMP" : "ICMP"} />
          </dl>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-foreground mb-3">Último SNMP</h3>
          {ultimoSnmp ? (
            <dl className="text-sm space-y-2">
              <Linha rotulo="Hostname (SNMP)" valor={ultimoSnmp.hostname} />
              <Linha rotulo="Descrição" valor={ultimoSnmp.descricao} />
              <Linha rotulo="Uptime" valor={ultimoSnmp.uptime_seconds ? `${Math.round(ultimoSnmp.uptime_seconds / 3600)}h` : "—"} />
              <Linha rotulo="CPU" valor={ultimoSnmp.cpu_pct ? `${ultimoSnmp.cpu_pct}%` : "—"} />
              <Linha rotulo="Memória" valor={ultimoSnmp.memoria_pct ? `${ultimoSnmp.memoria_pct}%` : "—"} />
            </dl>
          ) : (
            <p className="text-sm text-foreground-subtle">Nenhuma coleta SNMP registrada para este equipamento ainda.</p>
          )}
        </Card>
      </div>

      <TrafegoFlowsCard equipamentoId={equipamento.id} />
    </AppLayout>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  return (
    <div className="flex justify-between border-b border-surface-border/60 pb-2">
      <dt className="text-foreground-subtle">{rotulo}</dt>
      <dd className="text-foreground">{valor || "—"}</dd>
    </div>
  );
}

interface InterfaceItem {
  if_index: number;
  if_descr: string;
  if_speed: number | null;
}
interface PontoTrafego {
  executado_em: string;
  download_mbps: number | null;
  upload_mbps: number | null;
}

const PERIODOS = [
  { valor: "1h", rotulo: "1 hora" },
  { valor: "6h", rotulo: "6 horas" },
  { valor: "24h", rotulo: "24 horas" },
  { valor: "7d", rotulo: "7 dias" },
];

function TrafegoInterfaceCard({ equipamentoId }: { equipamentoId: string }) {
  const [interfaces, setInterfaces] = useState<InterfaceItem[]>([]);
  const [ifIndex, setIfIndex] = useState<string>("");
  const [periodo, setPeriodo] = useState("24h");
  const [serie, setSerie] = useState<PontoTrafego[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get<InterfaceItem[]>(`/historico/interfaces/lista?equipamento_id=${equipamentoId}`).then((lista) => {
      setInterfaces(lista);
      if (lista.length > 0) setIfIndex(String(lista[0].if_index));
      setCarregando(false);
    });
  }, [equipamentoId]);

  useEffect(() => {
    if (!ifIndex) return;
    api
      .get<PontoTrafego[]>(`/historico/interfaces/trafego?equipamento_id=${equipamentoId}&if_index=${ifIndex}&periodo=${periodo}`)
      .then(setSerie);
  }, [equipamentoId, ifIndex, periodo]);

  const interfaceAtual = interfaces.find((i) => String(i.if_index) === ifIndex);

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="text-sm font-medium text-foreground">Tráfego de Rede (SNMP) — Download / Upload</h3>
        {interfaces.length > 0 && (
          <div className="flex items-center gap-2">
            <select className="input max-w-[220px] !py-1.5 text-xs" value={ifIndex} onChange={(e) => setIfIndex(e.target.value)}>
              {interfaces.map((i) => <option key={i.if_index} value={i.if_index}>{i.if_descr || `Interface ${i.if_index}`}</option>)}
            </select>
            <select className="input max-w-[130px] !py-1.5 text-xs" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              {PERIODOS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
            </select>
          </div>
        )}
      </div>

      {carregando ? (
        <p className="text-xs text-foreground-subtle">Carregando…</p>
      ) : interfaces.length === 0 ? (
        <p className="text-xs text-foreground-subtle">
          Nenhuma interface SNMP coletada ainda para este equipamento. Isso aparece automaticamente assim que houver ao menos duas coletas SNMP (o cálculo de banda precisa de dois pontos para medir a variação).
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={serie}>
              <defs>
                <linearGradient id="corDownload" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="corUpload" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--surface-border))" />
              <XAxis dataKey="executado_em" tickFormatter={(v) => new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} stroke="rgb(var(--foreground-subtle))" fontSize={11} />
              <YAxis stroke="rgb(var(--foreground-subtle))" fontSize={11} unit=" Mbps" />
              <Tooltip
                contentStyle={{ background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--surface-border))", borderRadius: 8, fontSize: 12, color: "rgb(var(--foreground))" }}
                labelStyle={{ color: "rgb(var(--foreground))" }}
                labelFormatter={(v) => new Date(v).toLocaleString("pt-BR")}
                formatter={(valor: any) => [`${valor} Mbps`, ""]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="download_mbps" name="Download" stroke="#6366F1" fill="url(#corDownload)" strokeWidth={2} connectNulls={false} />
              <Area type="monotone" dataKey="upload_mbps" name="Upload" stroke="#22C55E" fill="url(#corUpload)" strokeWidth={2} connectNulls={false} />
            </AreaChart>
          </ResponsiveContainer>
          {interfaceAtual?.if_speed && (
            <p className="text-xs text-foreground-subtle mt-2">Capacidade nominal da interface: {(interfaceAtual.if_speed / 1_000_000).toFixed(0)} Mbps</p>
          )}
        </>
      )}
    </Card>
  );
}

function formatarBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function TrafegoFlowsCard({ equipamentoId }: { equipamentoId: string }) {
  const [periodo, setPeriodo] = useState("24h");
  const [fluxos, setFluxos] = useState<FluxoTrafego[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    api
      .get<FluxoTrafego[]>(`/trafego/flows?equipamento_id=${equipamentoId}&periodo=${periodo}&limite=100`)
      .then(setFluxos)
      .finally(() => setCarregando(false));
  }, [equipamentoId, periodo]);

  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">Tráfego NetFlow / Syslog</h3>
          <p className="text-xs text-foreground-subtle mt-1">Fluxos capturados em que este equipamento foi o exportador (NetFlow) ou a origem do log (Syslog).</p>
        </div>
        <select className="input max-w-[130px] !py-1.5 text-xs" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          {PERIODOS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
        </select>
      </div>

      {carregando ? (
        <p className="text-xs text-foreground-subtle">Carregando…</p>
      ) : fluxos.length === 0 ? (
        <p className="text-xs text-foreground-subtle">
          Nenhum fluxo NetFlow ou Syslog registrado para este equipamento no período. Ative os coletores em Configurações → Tráfego e confirme que o equipamento está enviando dados para este servidor.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-foreground-subtle text-left border-b border-surface-border">
                <th className="py-1.5 pr-3">Origem</th>
                <th className="py-1.5 pr-3">IP origem</th>
                <th className="py-1.5 pr-3">IP destino</th>
                <th className="py-1.5 pr-3">Protocolo</th>
                <th className="py-1.5 pr-3">Aplicação</th>
                <th className="py-1.5 pr-3">Bytes</th>
                <th className="py-1.5">Quando</th>
              </tr>
            </thead>
            <tbody>
              {fluxos.map((f) => (
                <tr key={f.id} className="border-b border-surface-border/50">
                  <td className="py-1.5 pr-3 uppercase text-foreground-subtle">{f.origem_tipo}</td>
                  <td className="py-1.5 pr-3 font-mono text-foreground">{f.ip_origem || "—"}{f.porta_origem ? `:${f.porta_origem}` : ""}</td>
                  <td className="py-1.5 pr-3 font-mono text-foreground">{f.ip_destino || "—"}{f.porta_destino ? `:${f.porta_destino}` : ""}</td>
                  <td className="py-1.5 pr-3 text-foreground">{f.protocolo || "—"}</td>
                  <td className="py-1.5 pr-3 text-foreground">{f.aplicacao || "—"}</td>
                  <td className="py-1.5 pr-3 text-foreground">{formatarBytes(f.bytes)}</td>
                  <td className="py-1.5 text-foreground-subtle">{new Date(f.capturado_em).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
