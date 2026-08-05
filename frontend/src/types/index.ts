export type StatusEquipamento = "online" | "offline" | "instavel" | "desconhecido";
export type Perfil = "administrador" | "operador" | "visualizador";

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
  ativo: boolean;
  criado_em: string;
}

export interface Equipamento {
  id: string;
  nome: string;
  descricao?: string;
  empresa_id?: string | null;
  empresa_nome?: string | null;
  unidade_id?: string | null;
  departamento_id?: string | null;
  categoria_id?: string | null;
  categoria_nome?: string | null;
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
  criado_em: string;
  atualizado_em: string;
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

export interface ItemTrafego {
  chave: string;
  bytes: number;
  pct: number;
}

export interface ResumoTrafego {
  periodo: string;
  totalBytes: number;
  topIps: ItemTrafego[];
  topAplicacoes: ItemTrafego[];
  serieTempo: { quando: string; bytes: number }[];
}

export interface ConfigColetor {
  ativo: boolean;
  porta: number;
  rodando: boolean;
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
