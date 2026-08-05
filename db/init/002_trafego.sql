-- ============================================================================
-- InfraMonitor AI - migração 002
-- Tráfego de interfaces via SNMP + NetFlow/Syslog + suporte a agentes remotos
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Contadores de interface via SNMP (IF-MIB) — para o gráfico de Download/Upload
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historico_interfaces_snmp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id UUID NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  if_index INTEGER NOT NULL,
  if_descr TEXT,
  if_speed BIGINT,
  in_octets BIGINT,
  out_octets BIGINT,
  executado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hist_if_equip ON historico_interfaces_snmp(equipamento_id, if_index, executado_em DESC);

-- ---------------------------------------------------------------------------
-- Tráfego via NetFlow (v5) e Syslog — fluxos IP/porta/protocolo agregáveis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trafego_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_tipo TEXT NOT NULL CHECK (origem_tipo IN ('netflow', 'syslog', 'agente')),
  equipamento_id UUID REFERENCES equipamentos(id) ON DELETE SET NULL,
  ip_exportador TEXT,
  ip_origem TEXT,
  ip_destino TEXT,
  porta_origem INTEGER,
  porta_destino INTEGER,
  protocolo TEXT,
  aplicacao TEXT,
  bytes BIGINT NOT NULL DEFAULT 0,
  pacotes BIGINT NOT NULL DEFAULT 0,
  capturado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trafego_flows_tempo ON trafego_flows(capturado_em DESC);
CREATE INDEX IF NOT EXISTS idx_trafego_flows_ip_origem ON trafego_flows(ip_origem);
CREATE INDEX IF NOT EXISTS idx_trafego_flows_ip_destino ON trafego_flows(ip_destino);

-- Mensagens de syslog cruas (guardadas mesmo quando não foi possível extrair um fluxo estruturado)
CREATE TABLE IF NOT EXISTS logs_syslog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_origem TEXT,
  mensagem TEXT NOT NULL,
  recebido_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_logs_syslog_tempo ON logs_syslog(recebido_em DESC);

-- ---------------------------------------------------------------------------
-- Configurações padrão do módulo de tráfego (ativação via UI, sem restart)
-- ---------------------------------------------------------------------------
INSERT INTO configuracoes (chave, valor) VALUES
  ('netflow', '{"ativo": false, "porta": 2055}'),
  ('syslog', '{"ativo": false, "porta": 1514}')
ON CONFLICT (chave) DO NOTHING;
