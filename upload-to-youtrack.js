require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const YOUTRACK_BASE_URL = process.env.YOUTRACK_BASE_URL;
const YOUTRACK_TOKEN = process.env.YOUTRACK_TOKEN;
const PROJECT_ID = '0-0';
const DB_EXPORT_FILE = './test-results-db.json';

// ==================== EXPORTAR A INDEXEDDB (para gestor.html) ====================

function saveToDbExport(allTestResults) {
  const dbData = {
    lastUpdated: new Date().toISOString(),
    exportedBy: 'upload-to-youtrack.js',
    results: allTestResults
  };
  fs.writeFileSync(DB_EXPORT_FILE, JSON.stringify(dbData, null, 2));
  console.log(`📁 Resultados también exportados a ${DB_EXPORT_FILE}`);
}

// ==================== SUBIDA A YOUTRACK ====================

async function uploadResults() {
  try {
    if (!fs.existsSync('./test-results.json')) return console.error('No se encontró el reporte.');

    const report = JSON.parse(fs.readFileSync('./test-results.json', 'utf8'));
    const counterFile = './counter.json';
    let counterData = fs.existsSync(counterFile) ? JSON.parse(fs.readFileSync(counterFile, 'utf8')) : { current: 100 };
    let counter = counterData.current;

    // Recolectar todos los resultados para exportar a DB
    const allTestResults = [];

    for (const suite of report.suites) {
      for (const spec of suite.specs) {
        for (const test of spec.tests) {
          const result = test.results[0];
          const testStatus = result.status.toUpperCase();
          const screenshots = result.attachments?.filter(a => a.contentType === 'image/png') || [];

          // --- LÓGICA DE INFERENCIA PARA QA SENIOR ---
          const pasos = result.steps && result.steps.length > 0
            ? result.steps.map((s, i) => ({
                description: `${i + 1}. ${s.title}`,
                expected: '',
                data: '',
                passed: !s.error
              }))
            : [{ description: 'Ejecutar secuencia de comandos', expected: '', data: '', passed: testStatus === 'PASSED' }];

          // Inferencia de Resultado Esperado
          let resEsperado = "El sistema debe procesar la solicitud sin errores de integridad.";
          const title = spec.title.toLowerCase();
          if (title.includes('login')) resEsperado = "Autenticación exitosa del usuario y redirección correcta al Dashboard.";
          else if (title.includes('search') || title.includes('búsqueda')) resEsperado = "Visualización de resultados relevantes y consistentes.";
          else if (title.includes('scraping') || title.includes('extracción')) resEsperado = "Extracción precisa de los nodos de datos definidos.";

          // Inferencia de Resultado Obtenido
          let resObtenido = "";
          if (testStatus === 'PASSED') {
            resObtenido = `Flujo completado con éxito. ${result.steps?.length || 0} validaciones exitosas.`;
          } else {
            const errorStep = result.steps?.find(s => s.error)?.title || "Desconocido";
            resObtenido = `Fallo: ${errorStep}. ${result.error?.message?.split('\n')[0] || ''}`;
          }

          // Agregar a resultados acumulados
          allTestResults.push({
            id: `CP-${counter}`,
            title: spec.title,
            category: testStatus === 'PASSED' ? 'Test Case (caso de éxito)' : 'Bug (fallo)',
            frequency: 'Siempre',
            status: testStatus === 'PASSED' ? 'Cerrado' : 'Nuevo',
            followUp: testStatus !== 'PASSED',
            followUpDate: null,
            steps: pasos,
            expectedResults: resEsperado,
            actualResult: resObtenido,
            notes: `Ejecutado: ${new Date().toISOString()}. Duración: ${result.duration}ms.`,
            version: report.config?.version || 'N/A',
            os: process.platform,
            browser: 'Desktop Chrome',
            env: 'Testing',
            resolution: '',
            device: '',
            build: '',
            images: screenshots.map(s => s.path),
            projectId: null,
            projectName: null,
            createdDate: new Date().toISOString(),
            executedFrom: 'upload-to-youtrack.js',
            testFile: spec.location?.file || ''
          });
          
          // 1. Inferencia de Pasos Detallados
          const pasosText = pasos.map((s, i) => {
              const icon = s.passed ? '✅' : '❌';
              return `${i + 1}. [${icon}] **Acción:** ${s.description.replace(/\d+\.\s*/, '')}`;
            }).join('\n');

          const descripcion = `
**CP-${counter} : ${spec.title}**

**Descripción:** Evaluación técnica de la funcionalidad "${spec.title}".
**Categoría:** ${testStatus === 'PASSED' ? 'Test Case (caso de éxito)' : 'Bug (fallo)'}
**Plataforma:** ${process.platform} - Navegador: Desktop Chrome (v${report.config?.version || 'N/A'})

**Pasos de Ejecución:**
${pasosText}

**Resultado Esperado:**
${resEsperado}

**Resultado Obtenido:**
${resObtenido}

**Estado:** ${testStatus === 'PASSED' ? 'APROBADO ✅' : 'FALLIDO ❌'}

**Observaciones:**
${screenshots.length} captura(s) adjunta(s). ${testStatus === 'PASSED' ? 'Sin regresiones.' : 'Requiere revisión.'}
          `;

          try {
            const issueRes = await axios.post(`${YOUTRACK_BASE_URL}/api/issues`, {
              project: { id: PROJECT_ID },
              summary: `CP-${counter} : ${spec.title}`,
              description: descripcion
            }, {
              headers: { 'Authorization': `Bearer ${YOUTRACK_TOKEN}`, 'Content-Type': 'application/json' }
            });
            
            const issueId = issueRes.data.id;
            console.log(`✅ Issue CP-${counter} creado con análisis de QA.`);

            for (const shot of screenshots) {
              if (fs.existsSync(shot.path)) {
                const form = new FormData();
                form.append('file', fs.createReadStream(shot.path));
                await axios.post(`${YOUTRACK_BASE_URL}/api/issues/${issueId}/attachments`, form, {
                  headers: { ...form.getHeaders(), 'Authorization': `Bearer ${YOUTRACK_TOKEN}` }
                });
                console.log(`📸 Evidencia adjuntada a CP-${counter}`);
              }
            }

            counter++;
          } catch (err) {
            console.error(`❌ Error en CP-${counter}:`, err.response?.data?.error_description || err.message);
          }
        }
      }
    }

    fs.writeFileSync(counterFile, JSON.stringify({ current: counter }));

    // Exportar a formato para IndexedDB (gestor.html)
    saveToDbExport(allTestResults);

  } catch (error) {
    console.error('Error general:', error.message);
  }
}

uploadResults();
