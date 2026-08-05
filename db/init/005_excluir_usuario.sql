-- ============================================================================
-- InfraMonitor AI - migração 005
-- Permite excluir definitivamente um usuário sem quebrar o histórico de
-- logs/alertas já registrado: as referências passam a virar NULL em vez de
-- bloquear o DELETE (o registro de log/alerta em si é preservado).
-- ============================================================================

ALTER TABLE logs DROP CONSTRAINT IF EXISTS logs_usuario_id_fkey;
ALTER TABLE logs ADD CONSTRAINT logs_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE alertas DROP CONSTRAINT IF EXISTS alertas_confirmado_por_fkey;
ALTER TABLE alertas ADD CONSTRAINT alertas_confirmado_por_fkey
  FOREIGN KEY (confirmado_por) REFERENCES usuarios(id) ON DELETE SET NULL;
