-- ============================================================================
-- InfraMonitor AI - schema inicial
-- Executado automaticamente pelo container Postgres na primeira subida
-- (docker-entrypoint-initdb.d). Também pode ser aplicado manualmente em um
-- projeto Supabase Cloud via SQL editor.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE perfil_usuario AS ENUM ('administrador', 'operador', 'visualizador');
CREATE TYPE status_equipamento AS ENUM ('online', 'offline', 'instavel', 'desconhecido');
CREATE TYPE tipo_monitoramento AS ENUM ('ping', 'snmp', 'rustdesk', 'agente');
CREATE TYPE severidade_alerta AS ENUM ('baixa', 'media', 'alta', 'critica');
CREATE TYPE status_alerta AS ENUM ('aberto', 'confirmado', 'resolvido');
CREATE TYPE canal_notificacao AS ENUM ('email', 'teams', 'telegram', 'slack', 'webhook');

-- ---------------------------------------------------------------------------
-- Estrutura organizacional
-- ---------------------------------------------------------------------------
CREATE TABLE empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  endereco TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE departamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID REFERENCES unidades(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  icone TEXT
);

-- ---------------------------------------------------------------------------
-- Usuários e permissões
-- ---------------------------------------------------------------------------
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  perfil perfil_usuario NOT NULL DEFAULT 'visualizador',
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  recurso TEXT NOT NULL,
  pode_ler BOOLEAN NOT NULL DEFAULT true,
  pode_escrever BOOLEAN NOT NULL DEFAULT false,
  pode_excluir BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (usuario_id, recurso)
);

-- ---------------------------------------------------------------------------
-- Equipamentos
-- ---------------------------------------------------------------------------
CREATE TABLE equipamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  unidade_id UUID REFERENCES unidades(id) ON DELETE SET NULL,
  departamento_id UUID REFERENCES departamentos(id) ON DELETE SET NULL,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  localizacao TEXT,
  responsavel TEXT,
  fabricante TEXT,
  modelo TEXT,
  tipo TEXT,
  sistema_operacional TEXT,
  hostname TEXT,
  ip TEXT NOT NULL,
  mascara TEXT,
  gateway TEXT,
  dns TEXT,
  mac_address TEXT,
  numero_serie TEXT,
  patrimonio TEXT,
  rustdesk_id TEXT,
  snmp_version TEXT DEFAULT 'v2c',
  snmp_community_enc TEXT,
  snmp_username TEXT,
  snmp_password_enc TEXT,
  snmp_auth_protocol TEXT,
  snmp_privacy_protocol TEXT,
  intervalo_monitoramento INTEGER NOT NULL DEFAULT 60,
  timeout_ms INTEGER NOT NULL DEFAULT 2000,
  tentativas INTEGER NOT NULL DEFAULT 3,
  observacoes TEXT,
  status status_equipamento NOT NULL DEFAULT 'desconhecido',
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_equipamentos_status ON equipamentos(status);
CREATE INDEX idx_equipamentos_categoria ON equipamentos(categoria_id);
CREATE INDEX idx_equipamentos_ip ON equipamentos(ip);

-- ---------------------------------------------------------------------------
-- Monitoramento (log genérico + históricos detalhados, nunca sobrescritos)
-- ---------------------------------------------------------------------------
CREATE TABLE monitoramentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id UUID NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  tipo tipo_monitoramento NOT NULL,
  status status_equipamento NOT NULL,
  executado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_monitoramentos_equip ON monitoramentos(equipamento_id, executado_em DESC);

CREATE TABLE historico_ping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id UUID NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  online BOOLEAN NOT NULL,
  tempo_ms NUMERIC,
  ttl INTEGER,
  packet_loss_pct NUMERIC,
  jitter_ms NUMERIC,
  executado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hist_ping_equip ON historico_ping(equipamento_id, executado_em DESC);

CREATE TABLE historico_snmp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id UUID NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  hostname TEXT,
  descricao TEXT,
  uptime_seconds BIGINT,
  cpu_pct NUMERIC,
  memoria_pct NUMERIC,
  disco_pct NUMERIC,
  temperatura_c NUMERIC,
  modelo TEXT,
  versao_firmware TEXT,
  raw JSONB,
  executado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hist_snmp_equip ON historico_snmp(equipamento_id, executado_em DESC);

-- ---------------------------------------------------------------------------
-- Alertas e notificações
-- ---------------------------------------------------------------------------
CREATE TABLE alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id UUID NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  severidade severidade_alerta NOT NULL DEFAULT 'media',
  mensagem TEXT NOT NULL,
  status status_alerta NOT NULL DEFAULT 'aberto',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmado_em TIMESTAMPTZ,
  confirmado_por UUID REFERENCES usuarios(id)
);
CREATE INDEX idx_alertas_status ON alertas(status);
CREATE INDEX idx_alertas_equip ON alertas(equipamento_id, criado_em DESC);

CREATE TABLE notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alerta_id UUID NOT NULL REFERENCES alertas(id) ON DELETE CASCADE,
  canal canal_notificacao NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  enviado_em TIMESTAMPTZ,
  resposta TEXT
);

-- ---------------------------------------------------------------------------
-- Configurações e auditoria
-- ---------------------------------------------------------------------------
CREATE TABLE configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE,
  valor JSONB NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id),
  acao TEXT NOT NULL,
  entidade TEXT,
  entidade_id UUID,
  detalhes JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_logs_criado_em ON logs(criado_em DESC);

-- ---------------------------------------------------------------------------
-- Seeds essenciais
-- ---------------------------------------------------------------------------
INSERT INTO categorias (nome, icone) VALUES
  ('Computador', 'monitor'),
  ('Notebook', 'laptop'),
  ('Servidor', 'server'),
  ('Firewall', 'shield'),
  ('Switch', 'network'),
  ('Access Point', 'wifi'),
  ('Impressora', 'printer'),
  ('Storage', 'hard-drive'),
  ('Nobreak', 'battery'),
  ('Outro', 'box');

INSERT INTO configuracoes (chave, valor) VALUES
  ('tema', '{"padrao": "dark"}'),
  ('idioma', '{"padrao": "pt-BR"}'),
  ('smtp', '{}'),
  ('webhook', '{}'),
  ('snmp_padrao', '{"version": "v2c", "community": "public", "timeout_ms": 2000}'),
  ('backup', '{}');

-- O usuário administrador padrão é criado pelo backend na primeira subida
-- (ver backend/src/bootstrap.ts), pois a senha precisa ser hasheada com bcrypt.
