import { FormEvent, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { ArrowLeft, Plus, Minus, Radar, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { AppLayout } from "../components/layout/AppLayout";
import { Card } from "../components/ui/Card";
import { StatusBadge } from "../components/ui/StatusBadge";
import { Equipamento, FluxoTrafego, OidMonitorado, OidEncontrado } from "../types";

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
      {equipamento.tipo_monitoramento === "snmp" && <OidsMonitoradosCard equipamentoId={equipamento.id} />}

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
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [periodo, setPeriodo] = useState("24h");
  const [serie, setSerie] = useState<PontoTrafego[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarSeletor, setMostrarSeletor] = useState(false);

  useEffect(() => {
    api.get<InterfaceItem[]>(`/historico/interfaces/lista?equipamento_id=${equipamentoId}`).then((lista) => {
      setInterfaces(lista);
      if (lista.length > 0) setSelecionadas([String(lista[0].if_index)]);
      setCarregando(false);
    });
  }, [equipamentoId]);

  useEffect(() => {
    if (selecionadas.length === 0) { setSerie([]); return; }
    const query = selecionadas.map((i) => `if_index=${i}`).join("&");
    api
      .get<PontoTrafego[]>(`/historico/interfaces/trafego?equipamento_id=${equipamentoId}&${query}&periodo=${periodo}`)
      .then(setSerie);
  }, [equipamentoId, selecionadas, periodo]);

  function alternarInterface(ifIndex: string) {
    setSelecionadas((atual) =>
      atual.includes(ifIndex) ? atual.filter((i) => i !== ifIndex) : [...atual, ifIndex]
    );
  }

  const capacidadeTotal = interfaces
    .filter((i) => selecionadas.includes(String(i.if_index)) && i.if_speed)
    .reduce((soma, i) => soma + (i.if_speed || 0), 0);

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="text-sm font-medium text-foreground">Tráfego de Rede (SNMP) — Download / Upload</h3>
        {interfaces.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => setMostrarSeletor((v) => !v)}>
                {selecionadas.length === 0 ? "Selecionar interfaces…" : `${selecionadas.length} interface${selecionadas.length > 1 ? "s" : ""} selecionada${selecionadas.length > 1 ? "s" : ""}`}
              </button>
              {mostrarSeletor && (
                <div className="absolute right-0 z-10 mt-1 w-64 bg-surface-raised border border-surface-border rounded-lg shadow-lg p-2 max-h-64 overflow-y-auto">
                  {interfaces.map((i) => (
                    <label key={i.if_index} className="flex items-center gap-2 text-xs text-foreground px-2 py-1.5 rounded hover:bg-foreground/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selecionadas.includes(String(i.if_index))}
                        onChange={() => alternarInterface(String(i.if_index))}
                      />
                      {i.if_descr || `Interface ${i.if_index}`}
                    </label>
                  ))}
                </div>
              )}
            </div>
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
      ) : selecionadas.length === 0 ? (
        <p className="text-xs text-foreground-subtle">Selecione ao menos uma interface para ver o gráfico.</p>
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
          {capacidadeTotal > 0 && (
            <p className="text-xs text-foreground-subtle mt-2">Capacidade nominal somada das interfaces selecionadas: {(capacidadeTotal / 1_000_000).toFixed(0)} Mbps</p>
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
          Nenhum fluxo NetFlow ou Syslog registrado para este equipamento no período. Ative o NetFlow e/ou o Syslog no cadastro deste equipamento e confirme que ele está enviando dados para a porta configurada.
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

function OidsMonitoradosCard({ equipamentoId }: { equipamentoId: string }) {
  const [oids, setOids] = useState<OidMonitorado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novoOid, setNovoOid] = useState("");
  const [novoRotulo, setNovoRotulo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const [walking, setWalking] = useState(false);
  const [resultadoWalk, setResultadoWalk] = useState<OidEncontrado[] | null>(null);
  const [erroWalk, setErroWalk] = useState<string | null>(null);

  async function carregar() {
    setOids(await api.get<OidMonitorado[]>(`/equipamentos/${equipamentoId}/oids`));
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, [equipamentoId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function adicionar(oid: string, rotulo?: string) {
    setErro(null);
    try {
      await api.post(`/equipamentos/${equipamentoId}/oids`, { oid, rotulo: rotulo || undefined });
      carregar();
    } catch (e: any) {
      setErro(e.message || "Não foi possível adicionar o OID");
    }
  }

  async function adicionarManual(e: FormEvent) {
    e.preventDefault();
    if (!novoOid.trim()) return;
    await adicionar(novoOid.trim(), novoRotulo.trim());
    setNovoOid("");
    setNovoRotulo("");
  }

  async function remover(oidMonitorado: OidMonitorado) {
    setErro(null);
    try {
      await api.delete(`/equipamentos/${equipamentoId}/oids/${oidMonitorado.id}`);
      carregar();
    } catch (e: any) {
      setErro(e.message || "Não foi possível remover o OID");
    }
  }

  async function testarSnmpwalk() {
    setErroWalk(null);
    setWalking(true);
    setResultadoWalk(null);
    try {
      setResultadoWalk(await api.post<OidEncontrado[]>(`/equipamentos/${equipamentoId}/snmpwalk`, {}));
    } catch (e: any) {
      setErroWalk(e.message || "Falha ao executar o SNMPwalk");
    } finally {
      setWalking(false);
    }
  }

  const oidsJaMonitorados = new Set(oids.map((o) => o.oid));

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h3 className="text-sm font-medium text-foreground">Monitoramento SNMP avançado (OIDs customizados)</h3>
        <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={testarSnmpwalk} disabled={walking}>
          {walking ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />}
          {walking ? "Consultando…" : "Testar SNMPwalk"}
        </button>
      </div>
      <p className="text-xs text-foreground-subtle mb-4">
        Adicione OIDs específicos para coletar junto com o monitoramento SNMP padrão deste equipamento. Use o SNMPwalk para descobrir o que o dispositivo expõe, ou informe um OID manualmente.
      </p>

      {erroWalk && <p className="text-xs text-red-400 mb-3">{erroWalk}</p>}
      {resultadoWalk && (
        <div className="mb-4 border border-surface-border rounded-lg max-h-56 overflow-y-auto">
          {resultadoWalk.length === 0 ? (
            <p className="text-xs text-foreground-subtle p-3">O SNMPwalk não retornou nenhum OID.</p>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {resultadoWalk.map((r) => (
                  <tr key={r.oid} className="border-b border-surface-border/50 last:border-0">
                    <td className="py-1.5 pl-3 pr-2 font-mono text-foreground-subtle whitespace-nowrap">{r.oid}</td>
                    <td className="py-1.5 pr-2 text-foreground-subtle whitespace-nowrap">{r.tipo}</td>
                    <td className="py-1.5 pr-2 text-foreground truncate max-w-[220px]" title={r.valor}>{r.valor}</td>
                    <td className="py-1.5 pr-3 text-right">
                      {oidsJaMonitorados.has(r.oid) ? (
                        <span className="text-foreground-subtle">monitorado</span>
                      ) : (
                        <button
                          type="button"
                          className="text-foreground-subtle hover:text-brand"
                          title="Adicionar aos monitorados"
                          onClick={() => adicionar(r.oid)}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <h4 className="text-xs font-semibold text-foreground-muted uppercase tracking-wide mb-2">OIDs monitorados</h4>
      {carregando ? (
        <p className="text-xs text-foreground-subtle">Carregando…</p>
      ) : (
        <ul className="space-y-1.5 mb-3 max-h-56 overflow-y-auto">
          {oids.map((o) => (
            <li key={o.id} className="flex items-center justify-between text-xs bg-surface rounded-lg px-3 py-2 gap-2">
              <div className="min-w-0">
                <span className="font-mono text-foreground">{o.oid}</span>
                {o.rotulo && <span className="text-foreground-subtle ml-2">{o.rotulo}</span>}
                <div className="text-foreground-subtle mt-0.5">
                  {o.ultimo_valor != null ? (
                    <>Último valor: <span className="text-foreground">{o.ultimo_valor}</span> ({o.ultima_leitura_em && new Date(o.ultima_leitura_em).toLocaleString("pt-BR")})</>
                  ) : (
                    "Ainda sem leitura"
                  )}
                </div>
              </div>
              <button type="button" className="text-foreground-subtle hover:text-red-400 shrink-0" title="Remover" onClick={() => remover(o)}>
                <Minus size={14} />
              </button>
            </li>
          ))}
          {oids.length === 0 && <p className="text-xs text-foreground-subtle">Nenhum OID customizado monitorado ainda.</p>}
        </ul>
      )}

      <form onSubmit={adicionarManual} className="flex gap-2">
        <input className="input font-mono text-xs" placeholder="OID (ex: 1.3.6.1.2.1.1.5.0)" value={novoOid} onChange={(e) => setNovoOid(e.target.value)} />
        <input className="input text-xs" placeholder="Rótulo (opcional)" value={novoRotulo} onChange={(e) => setNovoRotulo(e.target.value)} />
        <button className="btn-secondary shrink-0 !py-1.5 text-xs" type="submit">
          <Plus size={14} /> Adicionar
        </button>
      </form>
      {erro && <p className="text-xs text-red-400 mt-2">{erro}</p>}
    </Card>
  );
}
