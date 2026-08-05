-- ============================================================================
-- InfraMonitor AI - migração 003
-- Logo do cliente (para relatórios em PDF com a marca do cliente)
-- ============================================================================

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN empresas.logo_url IS 'Logo do cliente em data URL (base64), usado no cabeçalho dos relatórios em PDF.';
