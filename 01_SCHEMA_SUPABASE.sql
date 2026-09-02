-- ====================================
-- CASHAZO: Schema Mejorado para Supabase
-- ====================================

-- 1. TABLA PRINCIPAL: backup (datos sin documentos)
CREATE TABLE IF NOT EXISTS backup (
  id TEXT PRIMARY KEY,
  accs_data JSONB DEFAULT '[]',
  vendedores_data JSONB DEFAULT '{}',
  config_data JSONB DEFAULT '{}',
  redes_data JSONB DEFAULT '[]',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABLA PARA DOCUMENTOS (base64 se guarda aquí)
CREATE TABLE IF NOT EXISTS documentos (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  doc_key TEXT NOT NULL,
  filename TEXT,
  file_type TEXT,
  file_size BIGINT,
  base64_data TEXT, -- ✅ Aquí va el base64 (puede ser muy grande)
  fecha TEXT,
  hora TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cliente_id, doc_key)
);

-- 3. HABILITAR RLS
ALTER TABLE backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;

-- 4. ELIMINAR POLÍTICAS VIEJAS
DROP POLICY IF EXISTS "backup_select_public" ON backup;
DROP POLICY IF EXISTS "backup_insert_public" ON backup;
DROP POLICY IF EXISTS "backup_update_public" ON backup;
DROP POLICY IF EXISTS "backup_delete_public" ON backup;

DROP POLICY IF EXISTS "docs_select_public" ON documentos;
DROP POLICY IF EXISTS "docs_insert_public" ON documentos;
DROP POLICY IF EXISTS "docs_update_public" ON documentos;
DROP POLICY IF EXISTS "docs_delete_public" ON documentos;

-- 5. CREAR POLÍTICAS: Permitir acceso público
CREATE POLICY "backup_select_public" ON backup FOR SELECT USING (true);
CREATE POLICY "backup_insert_public" ON backup FOR INSERT WITH CHECK (true);
CREATE POLICY "backup_update_public" ON backup FOR UPDATE USING (true);
CREATE POLICY "backup_delete_public" ON backup FOR DELETE USING (true);

CREATE POLICY "docs_select_public" ON documentos FOR SELECT USING (true);
CREATE POLICY "docs_insert_public" ON documentos FOR INSERT WITH CHECK (true);
CREATE POLICY "docs_update_public" ON documentos FOR UPDATE USING (true);
CREATE POLICY "docs_delete_public" ON documentos FOR DELETE USING (true);

-- 6. OTORGAR PERMISOS
GRANT ALL ON backup TO anon, authenticated;
GRANT ALL ON documentos TO anon, authenticated;

-- 7. CREAR ÍNDICES
CREATE INDEX IF NOT EXISTS backup_id_idx ON backup(id);
CREATE INDEX IF NOT EXISTS backup_updated_at_idx ON backup(updated_at DESC);
CREATE INDEX IF NOT EXISTS docs_cliente_id_idx ON documentos(cliente_id);
CREATE INDEX IF NOT EXISTS docs_doc_key_idx ON documentos(cliente_id, doc_key);

-- 8. INSERTAR REGISTRO INICIAL
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
-- FIN DEL SCHEMA MEJORADO
-- ====================================
-- 
-- CAMBIOS:
-- ✅ Nueva tabla "documentos" para guardar base64
-- ✅ Documentos NO van en accs_data (menos peso en JSONB)
-- ✅ Índices para búsqueda rápida
-- 
-- PASOS:
-- 1. Ir a Supabase → SQL Editor
-- 2. New Query
-- 3. Copiar y pegar TODO
-- 4. Click en RUN
-- 5. Listo ✅
