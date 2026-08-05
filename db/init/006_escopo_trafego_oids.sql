-- ============================================================================
-- InfraMonitor AI - migração 006
-- Escopo de visibilidade de dados por usuário (clientes/unidades), NetFlow/
-- Syslog configuráveis por equipamento e monitoramento de OIDs customizados.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Escopo de dados: quais clientes/unidades cada usuário pode ver. Um usuário
-- sem nenhuma linha aqui não é restrito (continua vendo tudo, como hoje).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario_clientes_permitidos (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, empresa_id)
);

CREATE TABLE IF NOT EXISTS usuario_unidades_permitidas (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, unidade_id)
);

-- ---------------------------------------------------------------------------
-- NetFlow/Syslog configuráveis por equipamento (porta própria, em vez de um
-- único coletor global). O servidor abre um socket UDP por porta distinta
-- em uso entre os equipamentos ativos.
-- ---------------------------------------------------------------------------
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS netflow_ativo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS netflow_porta INTEGER;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS syslog_ativo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS syslog_porta INTEGER;

-- ---------------------------------------------------------------------------
-- Monitoramento de OIDs customizados por equipamento (além dos OIDs padrão
-- já coletados). Adicionados manualmente ou a partir de um SNMPwalk.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipamento_oids_monitorados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id UUID NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  oid TEXT NOT NULL,
  rotulo TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (equipamento_id, oid)
);

CREATE TABLE IF NOT EXISTS historico_oids_snmp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id UUID NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  oid TEXT NOT NULL,
  valor TEXT,
  executado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hist_oids_equip ON historico_oids_snmp(equipamento_id, oid, executado_em DESC);
