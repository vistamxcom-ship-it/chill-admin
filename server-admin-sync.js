const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan SUPABASE_URL / SUPABASE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(cors());
app.use(express.json({ limit: '100mb' })); // ✅ Aumentado para documentos base64

// Desactivar caché
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(express.static(__dirname, { etag: false, lastModified: false }));

// ============================================================================
// POST /sync — Guardar datos en Supabase (DIRECTAMENTE como JSONB)
// ============================================================================
app.post('/sync', async (req, res) => {
  try {
    const { accs, vendedores, cfg, redes } = req.body;
    
    console.log('📥 POST /sync recibido:', {
      accs: Array.isArray(accs) ? accs.length : 0,
      redes: Array.isArray(redes) ? redes.length : 0,
      vendedores: Object.keys(vendedores || {}).length
    });
    
    if (!Array.isArray(accs)) {
      return res.status(400).json({ success: false, error: 'accs debe ser array' });
    }
    
    // ✅ GUARDAR DIRECTAMENTE COMO JSONB (sin JSON.stringify)
    const { error } = await supabase
      .from('backup')
      .upsert({
        id: 'main',
        accs_data: accs, // ✅ Supabase lo convierte a JSONB automáticamente
        vendedores_data: vendedores || {},
        config_data: cfg || {},
        redes_data: redes || [],
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    
    if (error) {
      console.error('❌ Error UPSERT:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
    
    console.log('✅ Datos guardados en Supabase');
    return res.json({ 
      success: true,
      cuentas: accs.length,
      documentos: accs.reduce((sum, a) => sum + Object.keys(a.documentos || {}).length, 0)
    });
    
  } catch (err) {
    console.error('❌ POST /sync error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// GET /sync — Traer datos desde Supabase (DIRECTAMENTE como objetos)
// ============================================================================
app.get('/sync', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('backup')
      .select('*')
      .eq('id', 'main')
      .single();
    
    if (error && error.code === 'PGRST116') {
      console.log('ℹ️ Sin datos, devolviendo vacío');
      return res.json({ 
        accs: [], 
        vendedores: {}, 
        cfg: {}, 
        redes: []
      });
    }
    
    if (error) {
      console.error('❌ Error GET /sync:', error.message);
      return res.status(500).json({ error: error.message });
    }
    
    if (!data) {
      return res.json({ accs: [], vendedores: {}, cfg: {}, redes: [] });
    }
    
    // ✅ LEER DIRECTAMENTE COMO OBJETOS (sin necesidad de parsear)
    const response = {
      accs: Array.isArray(data.accs_data) ? data.accs_data : [],
      vendedores: typeof data.vendedores_data === 'object' ? data.vendedores_data : {},
      cfg: typeof data.config_data === 'object' ? data.config_data : {},
      redes: Array.isArray(data.redes_data) ? data.redes_data : [],
      updated_at: data.updated_at
    };
    
    console.log('✅ Datos traídos de Supabase:', {
      accs: response.accs.length,
      redes: response.redes.length
    });
    
    return res.json(response);
    
  } catch (err) {
    console.error('❌ GET /sync error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/health — Verificar estado
// ============================================================================
app.get('/api/health', async (req, res) => {
  try {
    const { error } = await supabase
      .from('backup')
      .select('count')
      .limit(1);
    
    return res.json({
      status: error ? 'error' : 'ok',
      supabase: error ? 'disconnected' : 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.json({
      status: 'error',
      supabase: 'error',
      error: err.message
    });
  }
});

// ============================================================================
// GET / — Servir admin.html
// ============================================================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ============================================================================
// INICIAR SERVIDOR
// ============================================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════╗
║   ✅ CASHAZO SERVER - SINCRONIZACIÓN   ║
║   Puerto: ${PORT}                           
║   Supabase: ${SUPABASE_URL ? '🟢 OK' : '🔴 Error'}                 
║   Admin: http://localhost:${PORT}           
╚════════════════════════════════════════╝
  `);
});
