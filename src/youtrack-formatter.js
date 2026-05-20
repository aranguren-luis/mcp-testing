/**
 * youtrack-formatter.js
 * Módulo compartido para formatear descripciones de tests para YouTrack.
 * Unifica el formato Markdown usado en ambos scripts.
 */

/**
 * Genera una descripción formateada en Markdown para YouTrack
 * @param {object} test - Datos del test (formato extraído por test-data-extractor)
 * @param {object} options - Opciones adicionales { includeImages, platform, browserVersion }
 * @returns {string} - Descripción Markdown formateada
 */
function formatYouTrackDescription(test, options = {}) {
  const {
    includeImages = true,
    platform = process.platform,
    browserVersion = 'N/A'
  } = options;

  const pasosText = test.steps.map((s, i) => {
    const icon = s.passed ? '✅' : '❌';
    return `${i + 1}. [${icon}] **Acción:** ${s.description.replace(/^\d+\.\s*/, '')}`;
  }).join('\n');

  const estadoEmoji = test.status === 'Cerrado' ? 'APROBADO ✅' : 'FALLIDO ❌';
  const observaciones = test.images?.length > 0
    ? `${test.images.length} captura(s) adjunta(s). ${test.status === 'Cerrado' ? 'Sin regresiones.' : 'Requiere revisión.'}`
    : `Sin capturas. ${test.status === 'Cerrado' ? 'Sin regresiones.' : 'Requiere revisión.'}`;

  return `
**${test.id} : ${test.title}**

**Descripción:** Evaluación técnica de la funcionalidad "${test.title}".
**Categoría:** ${test.category}
**Plataforma:** ${platform} - Navegador: Desktop Chrome (v${browserVersion})

**Pasos de Ejecución:**
${pasosText}

**Resultado Esperado:**
${test.expectedResults}

**Resultado Obtenido:**
${test.actualResult}

**Estado:** ${estadoEmoji}

**Observaciones:**
${observaciones}

---
*Generado automáticamente por Playwright + MCP Testing*
`.trim();
}

/**
 * Genera una versión corta de la descripción (para logs/metadata)
 * @param {object} test - Datos del test
 * @returns {string} - Descripción corta
 */
function formatShortDescription(test) {
  const passed = test.status === 'Cerrado';
  return `[${passed ? '✅' : '❌'}] ${test.id}: ${test.title} - ${test.actualResult.substring(0, 100)}`;
}

/**
 * Formatea un array de tests para un resumen
 * @param {Array} tests - Array de datos de tests
 * @returns {object} - Objeto con resumen { passed, failed, total }
 */
function formatSummary(tests) {
  const passed = tests.filter(t => t.status === 'Cerrado').length;
  const failed = tests.filter(t => t.status === 'Nuevo').length;
  const total = tests.length;

  return {
    total,
    passed,
    failed,
    passRate: total > 0 ? Math.round((passed / total) * 100) : 0
  };
}

module.exports = {
  formatYouTrackDescription,
  formatShortDescription,
  formatSummary
};
