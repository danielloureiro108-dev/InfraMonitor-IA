export type StatusEquipamento = "online" | "offline" | "instavel" | "desconhecido";
export type Perfil = "administrador" | "operador" | "visualizador";
export type TipoMonitoramento = "icmp" | "snmp";

export const ROTULO_PERFIL: Record<Perfil, string> = {
  administrador: "Admin",
  operador: "Editor",
  visualizador: "Viewer",
};

export interface Usuario {
  sub: string;
  nome: string;
  email: string;
  perfil: Perfil;
}

export interface UsuarioConta {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  unidade_id?: string | null;
  unidade_nome?: string | null;
  empresa_nome?: string | null;
  ativo: boolean;
  criado_em: string;
}

export interface PermissaoPapel {
  perfil: Perfil;
  recurso: string;
  pode_ler: boolean;
  pode_escrever: boolean;
  pode_excluir: boolean;
}

export interface Equipamento {
  id: string;
  nome: string;
  descricao?: string;
  empresa_id?: string | null;
  empresa_nome?: string | null;
  unidade_id?: string | null;
  unidade_nome?: string | null;
  departamento_id?: string | null;
  categoria_id?: string | null;
  categoria_nome?: string | null;
  tipo_monitoramento: TipoMonitoramento;
  localizacao?: string;
  responsavel?: string;
  fabricante?: string;
  modelo?: string;
  tipo?: string;
  sistema_operacional?: string;
  hostname?: string;
  ip: string;
  mascara?: string;
  gateway?: string;
  dns?: string;
  mac_address?: string;
  numero_serie?: string;
  patrimonio?: string;
  rustdesk_id?: string;
  snmp_version?: string;
  snmp_username?: string;
  snmp_auth_protocol?: string;
  snmp_privacy_protocol?: string;
  intervalo_monitoramento: number;
  timeout_ms: number;
  tentativas: number;
  observacoes?: string;
  status: StatusEquipamento;
  ativo: boolean;
  netflow_ativo: boolean;
  netflow_porta?: number | null;
  syslog_ativo: boolean;
  syslog_porta?: number | null;
  criado_em: string;
  atualizado_em: string;
}

export interface OidMonitorado {
  id: string;
  oid: string;
  rotulo?: string | null;
  ultimo_valor?: string | null;
  ultima_leitura_em?: string | null;
  criado_em: string;
}

export interface OidEncontrado {
  oid: string;
  tipo: string;
  valor: string;
}

export interface EscopoUsuario {
  empresa_ids: string[];
  unidade_ids: string[];
}

export interface ResumoDashboard {
  total: number;
  online: number;
  offline: number;
  instaveis: number;
  desconhecidos: number;
  alertas_abertos: number;
  latencia_media_ms: number;
  disponibilidade_24h_pct: number;
  disponibilidade_7d_pct: number;
  ultima_atualizacao: string | null;
}

export interface Alerta {
  id: string;
  equipamento_id: string;
  equipamento_nome: string;
  equipamento_ip: string;
  tipo: string;
  severidade: "baixa" | "media" | "alta" | "critica";
  mensagem: string;
  status: "aberto" | "confirmado" | "resolvido";
  criado_em: string;
}

export interface Categoria {
  id: string;
  nome: string;
  icone?: string;
}

export interface Empresa {
  id: string;
  nome: string;
  cnpj?: string;
  logo_url?: string | null;
}

export interface Unidade {
  id: string;
  empresa_id: string;
  nome: string;
  endereco?: string;
}

export interface FluxoTrafego {
  id: string;
  origem_tipo: "netflow" | "syslog" | "agente";
  ip_exportador: string | null;
  ip_origem: string | null;
  ip_destino: string | null;
  porta_origem: number | null;
  porta_destino: number | null;
  protocolo: string | null;
  aplicacao: string | null;
  bytes: number;
  pacotes: number;
  capturado_em: string;
}
