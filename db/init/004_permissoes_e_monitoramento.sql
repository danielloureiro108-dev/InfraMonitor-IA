-- ============================================================================
-- InfraMonitor AI - migração 004
-- Unidade do usuário, tipo de monitoramento do equipamento (ICMP/SNMP) e
-- matriz de permissões por papel (perfil x recurso).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Usuário vinculado a uma unidade (filial/site) — usado para restringir a
-- gestão de usuários por unidade em telas futuras e exibido no cadastro.
-- ---------------------------------------------------------------------------
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES unidades(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Tipo de monitoramento do equipamento: ICMP (somente ping) ou SNMP
-- (ping + métricas/tráfego de interface via SNMP).
-- ---------------------------------------------------------------------------
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS tipo_monitoramento TEXT NOT NULL DEFAULT 'icmp'
  CHECK (tipo_monitoramento IN ('icmp', 'snmp'));

-- Equipamentos que já têm SNMP configurado continuam coletando SNMP normalmente.
UPDATE equipamentos SET tipo_monitoramento = 'snmp' WHERE snmp_community_enc IS NOT NULL OR snmp_username IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Matriz de permissões por papel x recurso (área "Papéis x Itens" em
-- Configurações). Cada linha define se o papel pode ler/escrever/excluir
-- registros daquele recurso (ex: "equipamentos", "clientes").
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissoes_papel (
  perfil perfil_usuario NOT NULL,
  recurso TEXT NOT NULL,
  pode_ler BOOLEAN NOT NULL DEFAULT true,
  pode_escrever BOOLEAN NOT NULL DEFAULT false,
  pode_excluir BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (perfil, recurso)
);

-- Seed refletindo o comportamento atual do sistema (administrador tem acesso
-- total; operador cadastra/edita mas não exclui; visualizador só lê).
INSERT INTO permissoes_papel (perfil, recurso, pode_ler, pode_escrever, pode_excluir) VALUES
  ('administrador', 'equipamentos', true, true, true),
  ('operador',       'equipamentos', true, true, false),
  ('visualizador',   'equipamentos', true, false, false),

  ('administrador', 'clientes', true, true, true),
  ('operador',       'clientes', true, true, false),
  ('visualizador',   'clientes', true, false, false),

  ('administrador', 'unidades', true, true, true),
  ('operador',       'unidades', true, true, false),
  ('visualizador',   'unidades', true, false, false),

  ('administrador', 'departamentos', true, true, true),
  ('operador',       'departamentos', true, true, false),
  ('visualizador',   'departamentos', true, false, false),

  ('administrador', 'categorias', true, true, true),
  ('operador',       'categorias', true, true, false),
  ('visualizador',   'categorias', true, false, false),

  ('administrador', 'alertas', true, true, true),
  ('operador',       'alertas', true, true, false),
  ('visualizador',   'alertas', true, false, false),

  ('administrador', 'descoberta', true, true, false),
  ('operador',       'descoberta', true, true, false),
  ('visualizador',   'descoberta', true, false, false),

  ('administrador', 'relatorios', true, true, false),
  ('operador',       'relatorios', true, true, false),
  ('visualizador',   'relatorios', true, false, false),

  ('administrador', 'usuarios', true, true, true),
  ('operador',       'usuarios', false, false, false),
  ('visualizador',   'usuarios', false, false, false),

  ('administrador', 'configuracoes', true, true, false),
  ('operador',       'configuracoes', true, false, false),
  ('visualizador',   'configuracoes', true, false, false)
ON CONFLICT (perfil, recurso) DO NOTHING;
