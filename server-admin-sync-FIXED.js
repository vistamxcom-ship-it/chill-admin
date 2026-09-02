const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan SUPABASE_URL / SUPABASE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { transport: WebSocket }
});

app.use(cors());
app.use(express.json({ limit: '100mb' })); // ✅ Aumentado a 100mb para base64

// Desactivar caché
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(express.static(__dirname, { etag: false, lastModified: false }));

// ============================================================================
// POST /sync — Guardar datos + documentos
// ============================================================================
app.post('/sync', async (req, res) => {
  try {
    const { accs, vendedores, cfg, redes } = req.body;
    
    console.log('📥 POST /sync recibido');
    
    if (!Array.isArray(accs)) {
      return res.status(400).json({ success: false, error: 'accs debe ser array' });
    }
    
    // ✅ PASO 1: Guardar datos principales (sin documentos)
    const accsLimpios = accs.map(acc => {
      const { documentos, ...resto } = acc;
      return resto; // ✅ Remover documentos de accs_data
    });
    
    const { error: backupError } = await supabase
      .from('backup')
      .upsert({
        id: 'main',
        accs_data: accsLimpios, // ✅ Sin base64
        vendedores_data: vendedores || {},
        config_data: cfg || {},
        redes_data: redes || [],
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    
    if (backupError) {
      console.error('❌ Error guardando backup:', backupError.message);
      return res.status(500).json({ success: false, error: backupError.message });
    }
    
    console.log('✅ Datos guardados en backup');
    
    // ✅ PASO 2: Guardar documentos en tabla separada
    let docsGuardados = 0;
    for (const acc of accs) {
      if (acc.documentos && Object.keys(acc.documentos).length > 0) {
        for (const [docKey, docData] of Object.entries(acc.documentos)) {
          const docId = `${acc.id}_${docKey}`;
          
          const { error: docError } = await supabase
            .from('documentos')
            .upsert({
              id: docId,
              cliente_id: acc.id,
              doc_key: docKey,
              filename: docData.name,
              file_type: docData.type,
              file_size: docData.size,
              base64_data: docData.base64, // ✅ Base64 en tabla separada
              fecha: docData.fecha,
              hora: docData.hora
            }, { onConflict: 'cliente_id, doc_key' });
          
          if (!docError) docsGuardados++;
          else console.warn(`⚠️ Error guardando doc ${docKey}:`, docError.message);
        }
      }
    }
    
    console.log(`✅ ${docsGuardados} documentos guardados`);
    
    return res.json({
      success: true,
      guardado: {
        cuentas: accs.length,
        documentos: docsGuardados,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (err) {
    console.error('❌ POST /sync error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// GET /sync — Traer datos + documentos
// ============================================================================
app.get('/sync', async (req, res) => {
  try {
    // ✅ PASO 1: Traer datos principales
    const { data: backupData, error: backupError } = await supabase
      .from('backup')
      .select('*')
      .eq('id', 'main')
      .single();
    
    if (backupError && backupError.code !== 'PGRST116') {
      console.error('❌ Error GET backup:', backupError.message);
      return res.status(500).json({ error: backupError.message });
    }
    
    let accs = backupData?.accs_data || [];
    
    // ✅ PASO 2: Traer documentos y agregarlos a cada cuenta
    if (accs.length > 0) {
      const clienteIds = accs.map(acc => acc.id);
      
      const { data: docsData, error: docsError } = await supabase
        .from('documentos')
        .select('*')
        .in('cliente_id', clienteIds);
      
      if (!docsError && docsData && docsData.length > 0) {
        // Agrupar documentos por cliente
        accs = accs.map(acc => {
          const docsDelCliente = {};
          docsData.forEach(doc => {
            if (doc.cliente_id === acc.id) {
              docsDelCliente[doc.doc_key] = {
                name: doc.filename,
                type: doc.file_type,
                size: doc.file_size,
                base64: doc.base64_data, // ✅ Traer base64
                fecha: doc.fecha,
                hora: doc.hora
              };
            }
          });
          
          return {
            ...acc,
            documentos: docsDelCliente // ✅ Agregar documentos a la cuenta
          };
        });
        
        console.log(`✅ ${docsData.length} documentos traídos`);
      }
    }
    
    console.log('✅ Datos traídos de Supabase');
    return res.json({
      accs,
      vendedores: backupData?.vendedores_data || {},
      cfg: backupData?.config_data || {},
      redes: backupData?.redes_data || [],
      updated_at: backupData?.updated_at
    });
    
  } catch (err) {
    console.error('❌ GET /sync error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/health — Verificar salud
// ============================================================================
app.get('/api/health', async (req, res) => {
  try {
    const { error } = await supabase
      .from('backup')
      .select('count')
      .limit(1);
    
    const isConnected = !error;
    
    return res.json({
      status: isConnected ? 'ok' : 'error',
      supabase: isConnected ? 'connected' : 'disconnected',
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
║   ✅ CASHAZO SERVER ONLINE             ║
║   Port: ${PORT}                             
║   Supabase: ${SUPABASE_URL ? '🟢 OK' : '🔴 Error'}               
║   Documentos: ✅ Tabla separada        ║
╚════════════════════════════════════════╝
  `);
});
