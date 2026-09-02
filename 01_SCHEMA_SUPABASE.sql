-- ====================================
-- CASHAZO: Schema para Supabase
-- ====================================

-- 1. TABLA PRINCIPAL: backup (todos los datos del admin)
CREATE TABLE IF NOT EXISTS backup (
  id TEXT PRIMARY KEY,
  accs_data JSONB DEFAULT '[]',
  vendedores_data JSONB DEFAULT '{}',
  config_data JSONB DEFAULT '{}',
  redes_data JSONB DEFAULT '[]',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. HABILITAR RLS (Row Level Security)
ALTER TABLE backup ENABLE ROW LEVEL SECURITY;

-- 3. ELIMINAR POLÍTICAS VIEJAS
DROP POLICY IF EXISTS "backup_select_public" ON backup;
DROP POLICY IF EXISTS "backup_insert_public" ON backup;
DROP POLICY IF EXISTS "backup_update_public" ON backup;
DROP POLICY IF EXISTS "backup_delete_public" ON backup;

-- 4. CREAR NUEVAS POLÍTICAS: Permitir acceso público
CREATE POLICY "backup_select_public" ON backup
  FOR SELECT USING (true);

CREATE POLICY "backup_insert_public" ON backup
  FOR INSERT WITH CHECK (true);

CREATE POLICY "backup_update_public" ON backup
  FOR UPDATE USING (true);

CREATE POLICY "backup_delete_public" ON backup
  FOR DELETE USING (true);

-- 5. OTORGAR PERMISOS
GRANT ALL ON backup TO anon, authenticated;

-- 6. CREAR ÍNDICES
CREATE INDEX IF NOT EXISTS backup_id_idx ON backup(id);
CREATE INDEX IF NOT EXISTS backup_updated_at_idx ON backup(updated_at DESC);

-- 7. INSERTAR REGISTRO INICIAL VACÍO
INSERT INTO backup (id, accs_data, vendedores_data, config_data, redes_data, updated_at)
VALUES (
  'main',
  '[]'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '[]'::jsonb,
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  updated_at = NOW();

-- ====================================
-- FIN DEL SCHEMA
-- ====================================
-- 
-- Pasos:
-- 1. Ir a Supabase → SQL Editor
-- 2. New Query
-- 3. Copiar y pegar TODO
-- 4. Click en RUN
-- 5. Listo ✅
