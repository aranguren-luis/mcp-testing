/**
 * upload-to-youtrack.js
 * Sube los resultados de Playwright a YouTrack.
 * Usa los módulos compartidos para extracción y formateo.
 *
 * Uso:
 *   node upload-to-youtrack.js
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

// Módulos compartidos
const { parseTestResults, processAllResults } = require('./src/test-data-extractor');
const { formatYouTrackDescription } = require('./src/youtrack-formatter');
const { saveToDbExport } = require('./src/db-exporter');

const YOUTRACK_BASE_URL = process.env.YOUTRACK_BASE_URL;
const YOUTRACK_TOKEN = process.env.YOUTRACK_TOKEN;
const PROJECT_ID = '0-0';
const TEST_RESULTS_FILE = './test-results.json';
const COUNTER_FILE = './counter.json';
const DB_EXPORT_FILE = './test-results-db.json';

// ==================== CONTADOR ====================

function getNextCounter() {
  if (fs.existsSync(COUNTER_FILE)) {
    const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
    return data.current || 100;
  }
  return 100;
}

function incrementCounter(count) {
  const current = getNextCounter();
  fs.writeFileSync(COUNTER_FILE, JSON.stringify({ current: current + count }));
}

// ==================== SUBIDA A YOUTRACK ====================

async function uploadResults() {
  try {
    const report = parseTestResults(TEST_RESULTS_FILE);
    if (!report) {
      console.error('No se encontró el reporte.');
      return;
    }

    const allResults = processAllResults(report, { executedFrom: 'upload-to-youtrack.js' });

    if (allResults.length === 0) {
      console.log('No hay resultados para subir.');
      return;
    }

    // Asignar IDs secuenciales
    let counter = getNextCounter();
    allResults.forEach(test => {
      test.id = `CP-${counter}`;
      counter++;
    });
    incrementCounter(allResults.length);

    // Guardar en DB antes de subir (backup)
    saveToDbExport(allResults, 'upload-to-youtrack.js', DB_EXPORT_FILE);

    // Subir cada test a YouTrack
    for (const test of allResults) {
      try {
        const descripcion = formatYouTrackDescription(test, {
          platform: test.os,
          browserVersion: test.version
        });

        const issueRes = await axios.post(`${YOUTRACK_BASE_URL}/api/issues`, {
          project: { id: PROJECT_ID },
          summary: `${test.id} : ${test.title}`,
          description: descripcion
        }, {
          headers: { 'Authorization': `Bearer ${YOUTRACK_TOKEN}`, 'Content-Type': 'application/json' }
        });

        console.log(`✅ Issue ${test.id} creado con análisis de QA.`);

        // Adjuntar screenshots
        for (const imgPath of test.images) {
          if (fs.existsSync(imgPath)) {
            const form = new FormData();
            form.append('file', fs.createReadStream(imgPath));
            await axios.post(`${YOUTRACK_BASE_URL}/api/issues/${issueRes.data.id}/attachments`, form, {
              headers: { ...form.getHeaders(), 'Authorization': `Bearer ${YOUTRACK_TOKEN}` }
            });
            console.log(`📸 Evidencia adjuntada a ${test.id}`);
          }
        }
      } catch (err) {
        console.error(`❌ Error en ${test.id}:`, err.response?.data?.error_description || err.message);
      }
    }

    console.log(`\n✅ ${allResults.length} resultado(s) procesado(s) y subido(s) a YouTrack.`);

  } catch (error) {
    console.error('Error general:', error.message);
  }
}

uploadResults();
