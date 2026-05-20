/**
 * test-data-extractor.js
 * Módulo compartido para extraer datos estructurados de resultados de Playwright.
 * Unifica la lógica que antes estaba duplicada en playwright-to-db.js y upload-to-youtrack.js
 */

const fs = require('fs');

/**
 * Infiere el resultado esperado basándose en el título del test
 * @param {string} title - Título del test
 * @returns {string} - Descripción del resultado esperado
 */
function inferExpectedResult(title) {
  const t = title.toLowerCase();

  if (t.includes('login')) return 'Autenticación exitosa del usuario y redirección correcta al Dashboard.';
  if (t.includes('logout')) return 'Cierre de sesión y redirección al login.';
  if (t.includes('search') || t.includes('búsqueda')) return 'Visualización de resultados relevantes y consistentes.';
  if (t.includes('create') || t.includes('crear')) return 'Creación exitosa del registro.';
  if (t.includes('delete') || t.includes('eliminar')) return 'Eliminación exitosa del registro.';
  if (t.includes('update') || t.includes('edit') || t.includes('actualizar')) return 'Actualización correcta de datos.';
  if (t.includes('scraping') || t.includes('extracción')) return 'Extracción precisa de los nodos de datos definidos.';
  if (t.includes('form')) return 'Envío de formulario sin errores de validación.';
  if (t.includes('navigate') || t.includes('navegac')) return 'Navegación fluida entre páginas.';

  return 'El sistema debe procesar la solicitud sin errores de integridad.';
}

/**
 * Infiere el resultado obtenido basándose en el estado del test
 * @param {object} result - Resultado del test de Playwright
 * @param {boolean} passed - Si el test pasó
 * @returns {string} - Descripción del resultado obtenido
 */
function inferActualResult(result, passed) {
  if (passed) {
    return `Flujo completado con éxito. ${result.steps?.length || 0} validaciones exitosas.`;
  }

  const errorStep = result.steps?.find(s => s.error);
  const errorMsg = result.error?.message?.split('\n')[0] || '';
  return `Fallo: ${errorStep?.title || 'Error desconocido'}. ${errorMsg}`;
}

/**
 * Extrae los pasos de ejecución del test
 * @param {object} result - Resultado del test de Playwright
 * @param {boolean} passed - Si el test pasó
 * @returns {Array} - Array de pasos con description, expected, data, passed
 */
function extractSteps(result, passed) {
  if (result.steps && result.steps.length > 0) {
    return result.steps.map((s, i) => ({
      description: `${i + 1}. ${s.title}`,
      expected: '',
      data: '',
      passed: !s.error
    }));
  }

  return [{
    description: '1. Ejecutar secuencia de comandos',
    expected: '',
    data: '',
    passed
  }];
}

/**
 * Determina la categoría del test
 * @param {boolean} passed - Si el test pasó
 * @returns {string} - Categoría (Test Case o Bug)
 */
function determineCategory(passed) {
  return passed ? 'Test Case (caso de éxito)' : 'Bug (fallo)';
}

/**
 * Determina el estado del test
 * @param {boolean} passed - Si el test pasó
 * @returns {string} - Estado (Cerrado o Nuevo)
 */
function determineStatus(passed) {
  return passed ? 'Cerrado' : 'Nuevo';
}

/**
 * Extrae datos estructurados de un test de Playwright
 * @param {object} spec - Spec del reporte (suite.specs[i])
 * @param {object} test - Test individual (spec.tests[i])
 * @param {object} result - Resultado del test (test.results[0])
 * @param {object} report - Reporte completo de Playwright
 * @param {object} options - Opciones adicionales { idPrefix, projectName, projectId }
 * @returns {object} - Datos estructurados del test
 */
function extractTestData(spec, test, result, report, options = {}) {
  const passed = result.status === 'passed';
  const screenshots = result.attachments?.filter(a => a.contentType === 'image/png') || [];

  const pasos = extractSteps(result, passed);
  const title = spec.title;

  return {
    id: options.id || `CP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    title: title,
    category: determineCategory(passed),
    frequency: 'Siempre',
    status: determineStatus(passed),
    followUp: !passed,
    followUpDate: null,
    steps: pasos,
    expectedResults: inferExpectedResult(title),
    actualResult: inferActualResult(result, passed),
    notes: `Ejecutado: ${new Date().toISOString()}. Duración: ${result.duration}ms.`,
    version: report.config?.version || 'N/A',
    os: process.platform,
    browser: 'Desktop Chrome',
    env: 'Testing',
    resolution: '',
    device: '',
    build: '',
    images: screenshots.map(s => s.path),
    projectId: options.projectId || null,
    projectName: options.projectName || null,
    createdDate: new Date().toISOString(),
    executedFrom: options.executedFrom || 'Playwright',
    testFile: spec.location?.file || ''
  };
}

/**
 * Procesa el archivo test-results.json y devuelve todos los tests
 * @param {string} filePath - Ruta al archivo de resultados
 * @returns {Array|null} - Array de datos de tests o null si hay error
 */
function parseTestResults(filePath = './test-results.json') {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ No se encontró ${filePath}`);
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`❌ Error al parsear ${filePath}:`, e.message);
    return null;
  }
}

/**
 * Procesa todos los resultados de un reporte de Playwright
 * @param {object} report - Reporte de Playwright
 * @param {object} options - Opciones para extractTestData
 * @returns {Array} - Array de datos de tests
 */
function processAllResults(report, options = {}) {
  const allResults = [];

  for (const suite of report.suites) {
    for (const spec of suite.specs) {
      for (const test of spec.tests) {
        const result = test.results[0];
        const testData = extractTestData(spec, test, result, report, options);
        allResults.push(testData);
      }
    }
  }

  return allResults;
}

module.exports = {
  extractTestData,
  extractSteps,
  inferExpectedResult,
  inferActualResult,
  determineCategory,
  determineStatus,
  parseTestResults,
  processAllResults
};
