import { FormEvent, useEffect, useState } from "react";
import { Sun, Moon, Trash2, Plus, Radar, Loader2, UserPlus, Power, Building2, ImageUp, ShieldCheck, Pencil, X, Check } from "lucide-react";
import { api } from "../lib/api";
import { AppLayout } from "../components/layout/AppLayout";
import { Card } from "../components/ui/Card";
import { useAuth } from "../lib/auth";
import { useTheme } from "../hooks/useTheme";
import { Categoria, Empresa, Unidade, UsuarioConta, Usuario, Perfil, ROTULO_PERFIL, PermissaoPapel } from "../types";

interface ResultadoSnmp {
  hostname: string | null;
  descricao: string | null;
  uptimeSeconds: number | null;
  cpuPct: number | null;
  memoriaPct: number | null;
  raw?: Record<string, any>;
}

export default function Configuracoes() {
  const { usuario } = useAuth();
  const { escuro, definirTema } = useTheme();
  const [config, setConfig] = useState<Record<string, any>>({});
  const [smtp, setSmtp] = useState({ host: "", porta: 587, usuario: "" });
  const [webhook, setWebhook] = useState({ url: "" });
  const [snmpPadrao, setSnmpPadrao] = useState({ version: "v2c", community: "public", timeout_ms: 2000 });
  const [salvo, setSalvo] = useState<string | null>(null);

  const somenteAdmin = usuario?.perfil === "administrador";

  useEffect(() => {
    api.get<Record<string, any>>("/configuracoes").then((c) => {
      setConfig(c);
      if (c.smtp) setSmtp({ host: c.smtp.host || "", porta: c.smtp.porta || 587, usuario: c.smtp.usuario || "" });
      if (c.webhook) setWebhook({ url: c.webhook.url || "" });
      if (c.snmp_padrao) setSnmpPadrao(c.snmp_padrao);
    });
  }, []);

  async function salvar(chave: string, valor: any, e: FormEvent) {
    e.preventDefault();
    await api.put(`/configuracoes/${chave}`, valor);
    setSalvo(chave);
    setTimeout(() => setSalvo(null), 2000);
  }

  return (
    <AppLayout titulo="Configurações">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">
        <Card>
          <h3 className="text-sm font-semibold text-foreground mb-1">Aparência</h3>
          <p className="text-xs text-foreground-subtle mb-4">Escolha o tema da interface. A preferência fica salva neste navegador.</p>
          <div className="flex gap-2">
            <button
              onClick={() => definirTema(false)}
              className={!escuro ? "btn-primary" : "btn-secondary"}
            >
              <Sun size={16} /> Claro
            </button>
            <button
              onClick={() => definirTema(true)}
              className={escuro ? "btn-primary" : "btn-secondary"}
            >
              <Moon size={16} /> Escuro
            </button>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-foreground mb-4">Idioma</h3>
          <select className="input" defaultValue={config.idioma?.padrao || "pt-BR"} disabled={!somenteAdmin}>
            <option value="pt-BR">Português</option>
            <option value="en-US">English</option>
          </select>
        </Card>

        <ClientesCard somenteAdmin={somenteAdmin} />

        <UnidadesCard somenteAdmin={somenteAdmin} />

        <CategoriasCard somenteAdmin={somenteAdmin} />

        <UsuariosCard usuarioLogado={usuario} />

        <PermissoesCard somenteAdmin={somenteAdmin} />

        <TestarSnmpCard valoresPadrao={snmpPadrao} />

        <Card>
          <h3 className="text-sm font-semibold text-foreground mb-4">SMTP (alertas por e-mail)</h3>
          <form onSubmit={(e) => salvar("smtp", smtp, e)} className="space-y-3">
            <div>
              <label className="label">Servidor</label>
              <input className="input" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} disabled={!somenteAdmin} placeholder="smtp.empresa.com" />
            </div>
            <div>
              <label className="label">Porta</label>
              <input type="number" className="input" value={smtp.porta} onChange={(e) => setSmtp({ ...smtp, porta: Number(e.target.value) })} disabled={!somenteAdmin} />
            </div>
            <div>
              <label className="label">Usuário</label>
              <input className="input" value={smtp.usuario} onChange={(e) => setSmtp({ ...smtp, usuario: e.target.value })} disabled={!somenteAdmin} />
            </div>
            {somenteAdmin && <button className="btn-primary">{salvo === "smtp" ? "Salvo!" : "Salvar"}</button>}
            <p className="text-xs text-foreground-subtle">
              A senha SMTP é definida via variável de ambiente <code className="text-foreground-muted">SMTP_PASS</code> no arquivo .env, não fica salva no banco.
            </p>
          </form>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-foreground mb-4">Webhook de alertas</h3>
          <form onSubmit={(e) => salvar("webhook", webhook, e)} className="space-y-3">
            <div>
              <label className="label">URL</label>
              <input className="input" value={webhook.url} onChange={(e) => setWebhook({ url: e.target.value })} disabled={!somenteAdmin} placeholder="https://..." />
            </div>
            {somenteAdmin && <button className="btn-primary">{salvo === "webhook" ? "Salvo!" : "Salvar"}</button>}
            <p className="text-xs text-foreground-subtle">Para Teams, Slack ou Telegram, use um webhook de entrada compatível com JSON.</p>
          </form>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-foreground mb-4">SNMP padrão</h3>
          <form onSubmit={(e) => salvar("snmp_padrao", snmpPadrao, e)} className="space-y-3">
            <div>
              <label className="label">Versão padrão</label>
              <select className="input" value={snmpPadrao.version} onChange={(e) => setSnmpPadrao({ ...snmpPadrao, version: e.target.value })} disabled={!somenteAdmin}>
                <option value="v1">v1</option>
                <option value="v2c">v2c</option>
                <option value="v3">v3</option>
              </select>
            </div>
            <div>
              <label className="label">Community padrão</label>
              <input className="input" value={snmpPadrao.community} onChange={(e) => setSnmpPadrao({ ...snmpPadrao, community: e.target.value })} disabled={!somenteAdmin} />
            </div>
            {somenteAdmin && <button className="btn-primary">{salvo === "snmp_padrao" ? "Salvo!" : "Salvar"}</button>}
          </form>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-foreground mb-1">Backup</h3>
          <p className="text-xs text-foreground-subtle">
            Com o Postgres local do Docker, use <code className="text-foreground-muted">docker exec inframonitor-db pg_dump -U inframonitor inframonitor</code> para gerar um dump. Automação de backup agendado está no roteiro (Fase 3).
          </p>
        </Card>
      </div>
    </AppLayout>
  );
}

function lerArquivoComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

/**
 * Converte qualquer imagem (PNG/JPEG/WEBP/SVG) para um PNG em base64, desenhando-a
 * num <canvas>. Isso garante que o logo salvo sempre é compatível com o jsPDF
 * (que não sabe renderizar SVG diretamente) e já normaliza o tamanho.
 */
async function converterParaPngBase64(arquivo: File, tamanhoMax = 256): Promise<string> {
  try {
    const dataUrlOriginal = await lerArquivoComoBase64(arquivo);
    const imagem = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrlOriginal;
    });

    const escala = Math.min(1, tamanhoMax / Math.max(imagem.width, imagem.height));
    const largura = Math.max(1, Math.round(imagem.width * escala));
    const altura = Math.max(1, Math.round(imagem.height * escala));

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrlOriginal;
    ctx.drawImage(imagem, 0, 0, largura, altura);
    return canvas.toDataURL("image/png");
  } catch {
    // Se a rasterização falhar por algum motivo, guarda o arquivo original mesmo assim.
    return lerArquivoComoBase64(arquivo);
  }
}

function ClientesCard({ somenteAdmin }: { somenteAdmin: boolean }) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [enviandoLogoId, setEnviandoLogoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setEmpresas(await api.get<Empresa[]>("/org/empresas"));
  }

  useEffect(() => { carregar(); }, []);

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setErro(null);
    setSalvando(true);
    try {
      await api.post("/org/empresas", { nome: nome.trim(), cnpj: cnpj.trim() || undefined });
      setNome("");
      setCnpj("");
      carregar();
    } catch (e: any) {
      setErro(e.message || "Não foi possível criar o cliente");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este cliente? Equipamentos vinculados a ele ficarão sem cliente definido.")) return;
    await api.delete(`/org/empresas/${id}`);
    carregar();
  }

  async function trocarLogo(empresa: Empresa, arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    if (arquivo.size > 600 * 1024) {
      setErro("Escolha uma imagem menor que 600 KB (ideal: um PNG/SVG do logo, sem fundo, até ~200x200px).");
      return;
    }
    setEnviandoLogoId(empresa.id);
    try {
      const base64 = await converterParaPngBase64(arquivo);
      await api.put(`/org/empresas/${empresa.id}`, { logo_url: base64 });
      carregar();
    } catch (e: any) {
      setErro(e.message || "Não foi possível salvar o logo");
    } finally {
      setEnviandoLogoId(null);
    }
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-foreground mb-1">Clientes</h3>
      <p className="text-xs text-foreground-subtle mb-4">
        Essa lista alimenta os filtros por Cliente no Dashboard, Mapa e Histórico, o campo "Cliente" no cadastro de equipamentos, e o logo aqui cadastrado aparece no cabeçalho dos relatórios em PDF desse cliente.
      </p>

      <ul className="space-y-1.5 mb-4 max-h-60 overflow-y-auto">
        {empresas.map((emp) => (
          <li key={emp.id} className="flex items-center justify-between text-sm bg-surface rounded-lg px-3 py-1.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {emp.logo_url ? (
                <img src={emp.logo_url} alt="" className="w-7 h-7 rounded object-contain bg-white/90 shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded bg-foreground/10 shrink-0 flex items-center justify-center">
                  <Building2 size={14} className="text-foreground-subtle" />
                </div>
              )}
              <div className="min-w-0">
                <span className="text-foreground">{emp.nome}</span>
                {emp.cnpj && <span className="text-foreground-subtle text-xs ml-2">{emp.cnpj}</span>}
              </div>
            </div>
            {somenteAdmin && (
              <div className="flex items-center gap-1 shrink-0">
                <label className="text-foreground-subtle hover:text-brand cursor-pointer p-1" title="Trocar logo (para relatórios em PDF)">
                  {enviandoLogoId === emp.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ImageUp size={14} />
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => trocarLogo(emp, e.target.files?.[0])} />
                </label>
                <button onClick={() => excluir(emp.id)} className="text-foreground-subtle hover:text-red-400 p-1" title="Excluir cliente">
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </li>
        ))}
        {empresas.length === 0 && <p className="text-xs text-foreground-subtle">Nenhum cliente cadastrado.</p>}
      </ul>

      {somenteAdmin && (
        <form onSubmit={adicionar} className="space-y-2">
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Nome do cliente"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <input
              className="input max-w-[160px]"
              placeholder="CNPJ (opcional)"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
            />
          </div>
          <button className="btn-secondary shrink-0" disabled={salvando}>
            <Plus size={14} /> Adicionar cliente
          </button>
        </form>
      )}
      {erro && <p className="text-xs text-red-400 mt-2">{erro}</p>}
    </Card>
  );
}

function UnidadesCard({ somenteAdmin }: { somenteAdmin: boolean }) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => { api.get<Empresa[]>("/org/empresas").then(setEmpresas); }, []);

  async function carregar(empId: string) {
    if (!empId) { setUnidades([]); return; }
    setUnidades(await api.get<Unidade[]>(`/org/unidades?empresa_id=${empId}`));
  }

  useEffect(() => { carregar(empresaId); }, [empresaId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    if (!empresaId || !nome.trim()) return;
    setErro(null);
    setSalvando(true);
    try {
      await api.post("/org/unidades", { empresa_id: empresaId, nome: nome.trim(), endereco: endereco.trim() || undefined });
      setNome("");
      setEndereco("");
      carregar(empresaId);
    } catch (e: any) {
      setErro(e.message || "Não foi possível criar a unidade");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta unidade? Equipamentos vinculados a ela ficarão sem unidade definida.")) return;
    await api.delete(`/org/unidades/${id}`);
    carregar(empresaId);
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-foreground mb-1">Unidades</h3>
      <p className="text-xs text-foreground-subtle mb-4">Filiais/sites de um Cliente (ex: matriz, filial SP). Selecione o cliente para ver ou cadastrar unidades dele.</p>

      <select className="input mb-3" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
        <option value="">Selecione um cliente…</option>
        {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
      </select>

      {empresaId && (
        <>
          <ul className="space-y-1.5 mb-4 max-h-52 overflow-y-auto">
            {unidades.map((un) => (
              <li key={un.id} className="flex items-center justify-between text-sm bg-surface rounded-lg px-3 py-1.5">
                <div>
                  <span className="text-foreground">{un.nome}</span>
                  {un.endereco && <span className="text-foreground-subtle text-xs ml-2">{un.endereco}</span>}
                </div>
                {somenteAdmin && (
                  <button onClick={() => excluir(un.id)} className="text-foreground-subtle hover:text-red-400" title="Excluir unidade">
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
            {unidades.length === 0 && <p className="text-xs text-foreground-subtle">Nenhuma unidade cadastrada para este cliente.</p>}
          </ul>

          {somenteAdmin && (
            <form onSubmit={adicionar} className="space-y-2">
              <div className="flex gap-2">
                <input className="input" placeholder="Nome da unidade (ex: Matriz)" value={nome} onChange={(e) => setNome(e.target.value)} />
                <input className="input" placeholder="Endereço (opcional)" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
              </div>
              <button className="btn-secondary shrink-0" disabled={salvando}>
                <Plus size={14} /> Adicionar unidade
              </button>
            </form>
          )}
        </>
      )}
      {erro && <p className="text-xs text-red-400 mt-2">{erro}</p>}
    </Card>
  );
}

function UsuariosCard({ usuarioLogado }: { usuarioLogado: Usuario | null }) {
  const [usuarios, setUsuarios] = useState<UsuarioConta[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [unidadesPorEmpresa, setUnidadesPorEmpresa] = useState<Record<string, Unidade[]>>({});
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("visualizador");
  const [empresaId, setEmpresaId] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<{
    id: string; nome: string; email: string; empresaId: string; unidadeId: string; unidadeAlterada: boolean;
  } | null>(null);

  const souAdmin = usuarioLogado?.perfil === "administrador";

  async function carregar() {
    if (!souAdmin) return;
    setUsuarios(await api.get<UsuarioConta[]>("/auth/usuarios"));
  }

  useEffect(() => { carregar(); }, [souAdmin]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (souAdmin) api.get<Empresa[]>("/org/empresas").then(setEmpresas); }, [souAdmin]);

  async function carregarUnidades(empId: string) {
    if (!empId || unidadesPorEmpresa[empId]) return;
    const lista = await api.get<Unidade[]>(`/org/unidades?empresa_id=${empId}`);
    setUnidadesPorEmpresa((atual) => ({ ...atual, [empId]: lista }));
  }

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await api.post("/auth/usuarios", { nome, email, senha, perfil, unidade_id: unidadeId || undefined });
      setNome(""); setEmail(""); setSenha(""); setPerfil("visualizador"); setEmpresaId(""); setUnidadeId("");
      carregar();
    } catch (e: any) {
      setErro(e.message || "Não foi possível criar o usuário");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(u: UsuarioConta) {
    if (u.id === usuarioLogado?.sub) return;
    await api.patch(`/auth/usuarios/${u.id}`, { ativo: !u.ativo });
    carregar();
  }

  async function alterarPerfil(u: UsuarioConta, novoPerfil: Perfil) {
    if (u.id === usuarioLogado?.sub) return;
    await api.patch(`/auth/usuarios/${u.id}`, { perfil: novoPerfil });
    carregar();
  }

  function iniciarEdicao(u: UsuarioConta) {
    setErro(null);
    setEditando({ id: u.id, nome: u.nome, email: u.email, empresaId: "", unidadeId: "", unidadeAlterada: false });
  }

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setErro(null);
    try {
      const payload: Record<string, any> = { nome: editando.nome, email: editando.email };
      if (editando.unidadeAlterada) payload.unidade_id = editando.unidadeId || null;
      await api.patch(`/auth/usuarios/${editando.id}`, payload);
      setEditando(null);
      carregar();
    } catch (e: any) {
      setErro(e.message || "Não foi possível salvar as alterações");
    }
  }

  async function excluir(u: UsuarioConta) {
    if (u.id === usuarioLogado?.sub) return;
    if (!confirm(`Excluir o usuário "${u.nome}"? Essa ação não pode ser desfeita.`)) return;
    setErro(null);
    try {
      await api.delete(`/auth/usuarios/${u.id}`);
      carregar();
    } catch (e: any) {
      setErro(e.message || "Não foi possível excluir o usuário");
    }
  }

  return (
    <Card className="lg:col-span-2">
      <h3 className="text-sm font-semibold text-foreground mb-1">Usuários</h3>
      <p className="text-xs text-foreground-subtle mb-4">
        Cadastre editores e viewers. Admins têm acesso total (ajustável na matriz de permissões abaixo); editores podem cadastrar/editar itens; viewers só consultam.
        Vincule o usuário a uma unidade para deixar claro a qual filial/site ele pertence.
      </p>

      {!souAdmin ? (
        <p className="text-xs text-foreground-subtle">Somente administradores podem gerenciar usuários.</p>
      ) : (
        <>
          <ul className="space-y-1.5 mb-4 max-h-72 overflow-y-auto">
            {usuarios.map((u) =>
              editando?.id === u.id ? (
                <li key={u.id} className="bg-surface rounded-lg px-3 py-2">
                  <form onSubmit={salvarEdicao} className="grid grid-cols-2 gap-2">
                    <input
                      className="input !py-1 text-xs"
                      placeholder="Nome"
                      value={editando.nome}
                      onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                      required
                    />
                    <input
                      className="input !py-1 text-xs"
                      type="email"
                      placeholder="E-mail"
                      value={editando.email}
                      onChange={(e) => setEditando({ ...editando, email: e.target.value })}
                      required
                    />
                    <select
                      className="input !py-1 text-xs"
                      value={editando.empresaId}
                      onChange={(e) => {
                        const empId = e.target.value;
                        setEditando({ ...editando, empresaId: empId, unidadeId: "", unidadeAlterada: true });
                        carregarUnidades(empId);
                      }}
                    >
                      <option value="">Cliente (manter unidade atual)</option>
                      {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
                    </select>
                    <select
                      className="input !py-1 text-xs"
                      value={editando.unidadeId}
                      disabled={!editando.empresaId}
                      onChange={(e) => setEditando({ ...editando, unidadeId: e.target.value, unidadeAlterada: true })}
                    >
                      <option value="">Sem unidade</option>
                      {(unidadesPorEmpresa[editando.empresaId] || []).map((un) => <option key={un.id} value={un.id}>{un.nome}</option>)}
                    </select>
                    <div className="col-span-2 flex justify-end gap-2">
                      <button type="button" className="btn-secondary !py-1 text-xs" onClick={() => setEditando(null)}>
                        <X size={13} /> Cancelar
                      </button>
                      <button type="submit" className="btn-primary !py-1 text-xs">
                        <Check size={13} /> Salvar
                      </button>
                    </div>
                  </form>
                </li>
              ) : (
                <li key={u.id} className="flex items-center justify-between text-sm bg-surface rounded-lg px-3 py-2 gap-2 flex-wrap">
                  <div className="min-w-0">
                    <span className="text-foreground">{u.nome}</span>
                    <span className="text-foreground-subtle text-xs ml-2">{u.email}</span>
                    {u.unidade_nome && <span className="text-foreground-subtle text-xs ml-2">· {u.empresa_nome} / {u.unidade_nome}</span>}
                    {!u.ativo && <span className="text-red-400 text-xs ml-2">· inativo</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      className="input !py-1 !px-2 text-xs w-auto"
                      value={u.perfil}
                      disabled={u.id === usuarioLogado?.sub}
                      onChange={(e) => alterarPerfil(u, e.target.value as Perfil)}
                    >
                      <option value="administrador">{ROTULO_PERFIL.administrador}</option>
                      <option value="operador">{ROTULO_PERFIL.operador}</option>
                      <option value="visualizador">{ROTULO_PERFIL.visualizador}</option>
                    </select>
                    <button
                      onClick={() => iniciarEdicao(u)}
                      className="text-foreground-subtle hover:text-brand"
                      title="Editar usuário"
                    >
                      <Pencil size={14} />
                    </button>
                    {u.id !== usuarioLogado?.sub && (
                      <>
                        <button
                          onClick={() => alternarAtivo(u)}
                          className="text-foreground-subtle hover:text-brand"
                          title={u.ativo ? "Desativar usuário" : "Reativar usuário"}
                        >
                          <Power size={14} className={u.ativo ? "" : "text-red-400"} />
                        </button>
                        <button
                          onClick={() => excluir(u)}
                          className="text-foreground-subtle hover:text-red-400"
                          title="Excluir usuário"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            )}
            {usuarios.length === 0 && <p className="text-xs text-foreground-subtle">Nenhum usuário cadastrado ainda.</p>}
          </ul>

          <form onSubmit={adicionar} className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
            <input className="input" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="input" type="password" placeholder="Senha (mín. 6 caracteres)" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} />
            <select className="input" value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
              <option value="visualizador">{ROTULO_PERFIL.visualizador}</option>
              <option value="operador">{ROTULO_PERFIL.operador}</option>
              <option value="administrador">{ROTULO_PERFIL.administrador}</option>
            </select>
            <select
              className="input"
              value={empresaId}
              onChange={(e) => { setEmpresaId(e.target.value); setUnidadeId(""); carregarUnidades(e.target.value); }}
            >
              <option value="">Cliente (opcional)</option>
              {empresas.map((emp) => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
            </select>
            <select className="input" value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} disabled={!empresaId}>
              <option value="">Unidade (opcional)</option>
              {(unidadesPorEmpresa[empresaId] || []).map((un) => <option key={un.id} value={un.id}>{un.nome}</option>)}
            </select>
            <button className="btn-secondary col-span-2" disabled={salvando}>
              <UserPlus size={14} /> {salvando ? "Criando…" : "Criar usuário"}
            </button>
          </form>
          {erro && <p className="text-xs text-red-400 mt-2">{erro}</p>}
        </>
      )}
    </Card>
  );
}

const RECURSOS: { chave: string; rotulo: string }[] = [
  { chave: "equipamentos", rotulo: "Itens do cliente (equipamentos)" },
  { chave: "clientes", rotulo: "Clientes" },
  { chave: "unidades", rotulo: "Unidades" },
  { chave: "departamentos", rotulo: "Departamentos" },
  { chave: "categorias", rotulo: "Categorias" },
  { chave: "alertas", rotulo: "Alertas" },
  { chave: "descoberta", rotulo: "Descoberta de rede" },
  { chave: "relatorios", rotulo: "Relatórios" },
  { chave: "usuarios", rotulo: "Usuários" },
  { chave: "configuracoes", rotulo: "Configurações" },
];

const PAPEIS: Perfil[] = ["administrador", "operador", "visualizador"];

function PermissoesCard({ somenteAdmin }: { somenteAdmin: boolean }) {
  const [matriz, setMatriz] = useState<Record<string, PermissaoPapel>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    if (!somenteAdmin) { setCarregando(false); return; }
    try {
      const linhas = await api.get<PermissaoPapel[]>("/permissoes");
      const mapa: Record<string, PermissaoPapel> = {};
      linhas.forEach((l) => { mapa[`${l.perfil}:${l.recurso}`] = l; });
      setMatriz(mapa);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, [somenteAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  function valorCelula(perfil: Perfil, recurso: string): PermissaoPapel {
    return matriz[`${perfil}:${recurso}`] || { perfil, recurso, pode_ler: false, pode_escrever: false, pode_excluir: false };
  }

  async function alternar(perfil: Perfil, recurso: string, campo: "pode_ler" | "pode_escrever" | "pode_excluir") {
    if (perfil === "administrador") return; // administrador sempre tem acesso total, não é editável
    const atual = valorCelula(perfil, recurso);
    const novo = { ...atual, [campo]: !atual[campo] };
    setMatriz((m) => ({ ...m, [`${perfil}:${recurso}`]: novo }));
    setErro(null);
    try {
      await api.put(`/permissoes/${perfil}/${recurso}`, {
        pode_ler: novo.pode_ler,
        pode_escrever: novo.pode_escrever,
        pode_excluir: novo.pode_excluir,
      });
    } catch (e: any) {
      setMatriz((m) => ({ ...m, [`${perfil}:${recurso}`]: atual }));
      setErro(e.message || "Não foi possível salvar a permissão");
    }
  }

  return (
    <Card className="lg:col-span-2">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={16} className="text-brand" />
        <h3 className="text-sm font-semibold text-foreground">Permissões por papel</h3>
      </div>
      <p className="text-xs text-foreground-subtle mb-4">
        Defina o que cada papel pode fazer em cada tipo de item (ex: um Viewer pode visualizar os itens do cliente, mas não cadastrar nem excluir). Admin sempre tem acesso total.
      </p>

      {!somenteAdmin ? (
        <p className="text-xs text-foreground-subtle">Somente administradores podem gerenciar permissões.</p>
      ) : carregando ? (
        <p className="text-xs text-foreground-subtle">Carregando…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-foreground-subtle text-left border-b border-surface-border">
                <th className="py-1.5 pr-3">Item</th>
                {PAPEIS.map((p) => (
                  <th key={p} className="py-1.5 px-3 text-center whitespace-nowrap">{ROTULO_PERFIL[p]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RECURSOS.map((r) => (
                <tr key={r.chave} className="border-b border-surface-border/50">
                  <td className="py-2 pr-3 text-foreground whitespace-nowrap">{r.rotulo}</td>
                  {PAPEIS.map((p) => {
                    const c = valorCelula(p, r.chave);
                    const admin = p === "administrador";
                    return (
                      <td key={p} className="py-2 px-3">
                        <div className="flex items-center justify-center gap-2.5" title={admin ? "Administrador sempre tem acesso total" : undefined}>
                          <CheckboxPermissao rotulo="Ler" marcado={admin || c.pode_ler} desabilitado={admin} onChange={() => alternar(p, r.chave, "pode_ler")} />
                          <CheckboxPermissao rotulo="Escrever" marcado={admin || c.pode_escrever} desabilitado={admin} onChange={() => alternar(p, r.chave, "pode_escrever")} />
                          <CheckboxPermissao rotulo="Excluir" marcado={admin || c.pode_excluir} desabilitado={admin} onChange={() => alternar(p, r.chave, "pode_excluir")} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {erro && <p className="text-xs text-red-400 mt-2">{erro}</p>}
    </Card>
  );
}

function CheckboxPermissao({ rotulo, marcado, desabilitado, onChange }: { rotulo: string; marcado: boolean; desabilitado?: boolean; onChange: () => void }) {
  return (
    <label className={`flex flex-col items-center gap-0.5 ${desabilitado ? "opacity-50" : "cursor-pointer"}`} title={rotulo}>
      <input type="checkbox" checked={marcado} disabled={desabilitado} onChange={onChange} />
      <span className="text-[10px] text-foreground-subtle">{rotulo[0]}</span>
    </label>
  );
}
function CategoriasCard({ somenteAdmin }: { somenteAdmin: boolean }) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCategorias(await api.get<Categoria[]>("/org/categorias"));
  }

  useEffect(() => { carregar(); }, []);

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    if (!novaCategoria.trim()) return;
    setErro(null);
    setSalvando(true);
    try {
      await api.post("/org/categorias", { nome: novaCategoria.trim() });
      setNovaCategoria("");
      carregar();
    } catch (e: any) {
      setErro(e.message || "Não foi possível criar a categoria");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta categoria? Equipamentos que a usam ficarão sem categoria definida.")) return;
    await api.delete(`/org/categorias/${id}`);
    carregar();
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-foreground mb-1">Categorias / Tipos de equipamento</h3>
      <p className="text-xs text-foreground-subtle mb-4">Essa lista alimenta o campo "Categoria" no cadastro de equipamentos.</p>

      <ul className="space-y-1.5 mb-4 max-h-52 overflow-y-auto">
        {categorias.map((cat) => (
          <li key={cat.id} className="flex items-center justify-between text-sm bg-surface rounded-lg px-3 py-1.5">
            <span className="text-foreground">{cat.nome}</span>
            {somenteAdmin && (
              <button onClick={() => excluir(cat.id)} className="text-foreground-subtle hover:text-red-400" title="Excluir categoria">
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
        {categorias.length === 0 && <p className="text-xs text-foreground-subtle">Nenhuma categoria cadastrada.</p>}
      </ul>

      {somenteAdmin && (
        <form onSubmit={adicionar} className="flex gap-2">
          <input
            className="input"
            placeholder="Nova categoria (ex: Roteador)"
            value={novaCategoria}
            onChange={(e) => setNovaCategoria(e.target.value)}
          />
          <button className="btn-secondary shrink-0" disabled={salvando}>
            <Plus size={14} /> Adicionar
          </button>
        </form>
      )}
      {erro && <p className="text-xs text-red-400 mt-2">{erro}</p>}
    </Card>
  );
}

function TestarSnmpCard({ valoresPadrao }: { valoresPadrao: { version: string; community: string; timeout_ms: number } }) {
  const [ip, setIp] = useState("");
  const [versao, setVersao] = useState(valoresPadrao.version || "v2c");
  const [community, setCommunity] = useState(valoresPadrao.community || "public");
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSnmp | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function testar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setResultado(null);
    setTestando(true);
    try {
      const r = await api.post<ResultadoSnmp>("/equipamentos/snmp/testar", {
        ip,
        snmp_version: versao,
        community,
        timeout_ms: 3000,
      });
      setResultado(r);
      if (!r.hostname && !r.descricao) setErro("O dispositivo respondeu, mas não retornou dados SNMP — confira a community/versão.");
    } catch (e: any) {
      setErro(e.message || "Falha ao consultar SNMP");
    } finally {
      setTestando(false);
    }
  }

  return (
    <Card>
      <h3 className="text-sm font-semibold text-foreground mb-1">Testar consulta SNMP</h3>
      <p className="text-xs text-foreground-subtle mb-4">Confira se um IP responde SNMP antes de cadastrá-lo como equipamento.</p>

      <form onSubmit={testar} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input className="input font-mono" placeholder="IP (ex: 192.168.0.1)" value={ip} onChange={(e) => setIp(e.target.value)} required />
          <select className="input" value={versao} onChange={(e) => setVersao(e.target.value)}>
            <option value="v1">v1</option>
            <option value="v2c">v2c</option>
            <option value="v3">v3</option>
          </select>
        </div>
        <input className="input" placeholder="Community" value={community} onChange={(e) => setCommunity(e.target.value)} />
        <button type="submit" className="btn-primary" disabled={testando}>
          {testando ? <Loader2 size={16} className="animate-spin" /> : <Radar size={16} />}
          {testando ? "Consultando…" : "Testar"}
        </button>
      </form>

      {erro && <p className="text-xs text-red-400 mt-3">{erro}</p>}

      {resultado && (resultado.hostname || resultado.descricao) && (
        <dl className="text-sm mt-4 space-y-1.5 border-t border-surface-border pt-3">
          <LinhaResultado rotulo="Hostname" valor={resultado.hostname} />
          <LinhaResultado rotulo="Descrição" valor={resultado.descricao} />
          <LinhaResultado rotulo="Uptime" valor={resultado.uptimeSeconds ? `${Math.round(resultado.uptimeSeconds / 3600)}h` : undefined} />
          <LinhaResultado rotulo="CPU" valor={resultado.cpuPct ? `${resultado.cpuPct}%` : undefined} />
          <LinhaResultado rotulo="Memória" valor={resultado.memoriaPct ? `${resultado.memoriaPct}%` : undefined} />
        </dl>
      )}
    </Card>
  );
}

function LinhaResultado({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  return (
    <div className="flex justify-between">
      <dt className="text-foreground-subtle">{rotulo}</dt>
      <dd className="text-foreground">{valor || "—"}</dd>
    </div>
  );
}
