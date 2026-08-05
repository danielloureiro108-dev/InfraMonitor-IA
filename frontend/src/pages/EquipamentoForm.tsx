import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { AppLayout } from "../components/layout/AppLayout";
import { Card } from "../components/ui/Card";
import { Categoria, Empresa, Unidade } from "../types";

const VAZIO = {
  nome: "", descricao: "", empresa_id: "", unidade_id: "", categoria_id: "", localizacao: "", responsavel: "",
  fabricante: "", modelo: "", tipo: "", sistema_operacional: "",
  hostname: "", ip: "", mascara: "", gateway: "", dns: "", mac_address: "",
  numero_serie: "", patrimonio: "", rustdesk_id: "",
  tipo_monitoramento: "icmp",
  snmp_version: "v2c", snmp_community: "", snmp_username: "", snmp_password: "",
  snmp_auth_protocol: "", snmp_privacy_protocol: "",
  intervalo_monitoramento: 60, timeout_ms: 2000, tentativas: 3,
  observacoes: "", ativo: true,
  netflow_ativo: false, netflow_porta: 2055,
  syslog_ativo: false, syslog_porta: 1514,
};

export default function EquipamentoForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const editando = !!id;
  const navigate = useNavigate();
  const [dados, setDados] = useState<any>(VAZIO);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api.get<Categoria[]>("/org/categorias").then(setCategorias);
    api.get<Empresa[]>("/org/empresas").then(setEmpresas);
  }, []);

  useEffect(() => {
    if (!dados.empresa_id) { setUnidades([]); return; }
    api.get<Unidade[]>(`/org/unidades?empresa_id=${dados.empresa_id}`).then(setUnidades);
  }, [dados.empresa_id]);

  useEffect(() => {
    if (editando) {
      api.get(`/equipamentos/${id}`).then((eq: any) => setDados({ ...VAZIO, ...eq, snmp_community: "", snmp_password: "" }));
    } else {
      // Veio da tela de Descoberta com um IP encontrado na varredura?
      const ipPreenchido = searchParams.get("ip");
      if (ipPreenchido) setDados((d: any) => ({ ...d, ip: ipPreenchido }));
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function campo(nome: string, valor: any) {
    setDados((d: any) => ({ ...d, [nome]: valor }));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const payload = { ...dados, empresa_id: dados.empresa_id || null, unidade_id: dados.unidade_id || null, categoria_id: dados.categoria_id || null };
      if (editando) await api.put(`/equipamentos/${id}`, payload);
      else await api.post("/equipamentos", payload);
      navigate("/equipamentos");
    } catch (e: any) {
      setErro(e.message || "Não foi possível salvar o equipamento");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <AppLayout titulo={editando ? "Editar equipamento" : "Novo equipamento"}>
      <form onSubmit={salvar} className="space-y-6 max-w-4xl">
        <Card>
          <h3 className="text-sm font-semibold text-foreground mb-4">Identificação</h3>
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Nome *" value={dados.nome} onChange={(v) => campo("nome", v)} required />

            <div>
              <label className="label">Cliente</label>
              <select
                className="input"
                value={dados.empresa_id || ""}
                onChange={(e) => setDados((d: any) => ({ ...d, empresa_id: e.target.value, unidade_id: "" }))}
              >
                <option value="">Sem cliente definido</option>
                {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Unidade</label>
              <select className="input" value={dados.unidade_id || ""} onChange={(e) => campo("unidade_id", e.target.value)} disabled={!dados.empresa_id}>
                <option value="">Sem unidade definida</option>
                {unidades.map((un) => <option key={un.id} value={un.id}>{un.nome}</option>)}
              </select>
              {!dados.empresa_id && <p className="text-xs text-foreground-subtle mt-1">Selecione um cliente para escolher a unidade.</p>}
            </div>

            <div>
              <label className="label">Categoria</label>
              <select className="input" value={dados.categoria_id || ""} onChange={(e) => campo("categoria_id", e.target.value)}>
                <option value="">Sem categoria</option>
                {categorias.map((cat) => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
              </select>
              <p className="text-xs text-foreground-subtle mt-1">Gerencie a lista em Configurações → Categorias.</p>
            </div>

            <Campo label="Tipo" value={dados.tipo} onChange={(v) => campo("tipo", v)} placeholder="Ex: servidor de aplicação, roteador de borda…" />
            <Campo label="Descrição" value={dados.descricao} onChange={(v) => campo("descricao", v)} className="col-span-2" />
            <Campo label="Localização" value={dados.localizacao} onChange={(v) => campo("localizacao", v)} />
            <Campo label="Responsável" value={dados.responsavel} onChange={(v) => campo("responsavel", v)} />
            <Campo label="Fabricante" value={dados.fabricante} onChange={(v) => campo("fabricante", v)} />
            <Campo label="Modelo" value={dados.modelo} onChange={(v) => campo("modelo", v)} />
            <Campo label="Sistema Operacional" value={dados.sistema_operacional} onChange={(v) => campo("sistema_operacional", v)} />
            <Campo label="Número de série" value={dados.numero_serie} onChange={(v) => campo("numero_serie", v)} />
            <Campo label="Patrimônio" value={dados.patrimonio} onChange={(v) => campo("patrimonio", v)} />
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-foreground mb-4">Rede</h3>
          <div className="grid grid-cols-2 gap-4">
            <Campo label="IP *" value={dados.ip} onChange={(v) => campo("ip", v)} required placeholder="192.168.0.10" />
            <Campo label="Hostname" value={dados.hostname} onChange={(v) => campo("hostname", v)} />
            <Campo label="Máscara" value={dados.mascara} onChange={(v) => campo("mascara", v)} placeholder="255.255.255.0" />
            <Campo label="Gateway" value={dados.gateway} onChange={(v) => campo("gateway", v)} />
            <Campo label="DNS" value={dados.dns} onChange={(v) => campo("dns", v)} />
            <Campo label="MAC Address" value={dados.mac_address} onChange={(v) => campo("mac_address", v)} />
            <Campo label="RustDesk ID" value={dados.rustdesk_id} onChange={(v) => campo("rustdesk_id", v)} />
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-foreground mb-1">Tráfego (NetFlow / Syslog)</h3>
          <p className="text-xs text-foreground-subtle mb-4">
            Ative para receber exports de NetFlow v5 e/ou mensagens Syslog enviadas por este equipamento. Cada equipamento pode usar sua própria porta UDP.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm text-foreground shrink-0 mb-2">
                <input type="checkbox" checked={dados.netflow_ativo} onChange={(e) => campo("netflow_ativo", e.target.checked)} />
                NetFlow v5
              </label>
              <div className="flex-1">
                <label className="label">Porta UDP</label>
                <input
                  type="number"
                  className="input"
                  value={dados.netflow_porta}
                  onChange={(e) => campo("netflow_porta", Number(e.target.value))}
                  disabled={!dados.netflow_ativo}
                />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm text-foreground shrink-0 mb-2">
                <input type="checkbox" checked={dados.syslog_ativo} onChange={(e) => campo("syslog_ativo", e.target.checked)} />
                Syslog
              </label>
              <div className="flex-1">
                <label className="label">Porta UDP</label>
                <input
                  type="number"
                  className="input"
                  value={dados.syslog_porta}
                  onChange={(e) => campo("syslog_porta", Number(e.target.value))}
                  disabled={!dados.syslog_ativo}
                />
              </div>
            </div>
          </div>
        </Card>

        {dados.tipo_monitoramento === "snmp" && (
          <Card>
            <h3 className="text-sm font-semibold text-foreground mb-4">SNMP</h3>
            <div className="grid grid-cols-2 gap-4">
              <Campo label="Versão" tipo="select" opcoes={["v1", "v2c", "v3"]} value={dados.snmp_version} onChange={(v) => campo("snmp_version", v)} />
              <Campo
                label={editando ? "Community (deixe em branco para manter)" : "Community"}
                tipo="password"
                value={dados.snmp_community}
                onChange={(v) => campo("snmp_community", v)}
              />
              <Campo label="Usuário (v3)" value={dados.snmp_username} onChange={(v) => campo("snmp_username", v)} />
              <Campo
                label={editando ? "Senha v3 (deixe em branco para manter)" : "Senha (v3)"}
                tipo="password"
                value={dados.snmp_password}
                onChange={(v) => campo("snmp_password", v)}
              />
              <Campo label="Protocolo de autenticação (v3)" value={dados.snmp_auth_protocol} onChange={(v) => campo("snmp_auth_protocol", v)} />
              <Campo label="Protocolo de privacidade (v3)" value={dados.snmp_privacy_protocol} onChange={(v) => campo("snmp_privacy_protocol", v)} />
            </div>
            <p className="text-xs text-foreground-subtle mt-3">
              Quer testar a consulta SNMP antes de salvar? Use a ferramenta em Configurações → Testar consulta SNMP.
            </p>
          </Card>
        )}

        <Card>
          <h3 className="text-sm font-semibold text-foreground mb-4">Monitoramento</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Tipo de monitoramento</label>
              <select className="input" value={dados.tipo_monitoramento} onChange={(e) => campo("tipo_monitoramento", e.target.value)}>
                <option value="icmp">ICMP (somente ping)</option>
                <option value="snmp">SNMP (ping + métricas e tráfego de interface)</option>
              </select>
            </div>
            <Campo label="Intervalo (segundos)" tipo="number" value={dados.intervalo_monitoramento} onChange={(v) => campo("intervalo_monitoramento", Number(v))} />
            <Campo label="Timeout (ms)" tipo="number" value={dados.timeout_ms} onChange={(v) => campo("timeout_ms", Number(v))} />
            <Campo label="Tentativas" tipo="number" value={dados.tentativas} onChange={(v) => campo("tentativas", Number(v))} />
          </div>
          {dados.tipo_monitoramento === "snmp" && (
            <p className="text-xs text-foreground-subtle mt-3">
              Preencha os dados de acesso SNMP na seção acima. O gráfico de tráfego de entrada/saída com o seletor de interface fica disponível na tela do equipamento assim que houver coletas SNMP.
            </p>
          )}
          <div className="mt-4">
            <label className="label">Observações</label>
            <textarea className="input" rows={3} value={dados.observacoes} onChange={(e) => campo("observacoes", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 mt-4 text-sm text-foreground">
            <input type="checkbox" checked={dados.ativo} onChange={(e) => campo("ativo", e.target.checked)} />
            Equipamento ativo (monitorado)
          </label>
        </Card>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar equipamento"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/equipamentos")}>
            Cancelar
          </button>
        </div>
      </form>
    </AppLayout>
  );
}

function Campo({
  label, value, onChange, tipo = "text", opcoes, required, placeholder, className,
}: {
  label: string; value: any; onChange: (v: string) => void; tipo?: string;
  opcoes?: string[]; required?: boolean; placeholder?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {tipo === "select" ? (
        <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          {opcoes?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={tipo}
          className="input"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
