/**
 * db-exporter.js
 * Módulo compartido para exportar resultados a formato compatible con IndexedDB.
 * Usado por gestor.html para importar resultados de tests.
 */

const fs = require('fs');

const DEFAULT_EXPORT_FILE = './test-results-db.json';

/**
 * Guarda los resultados en un archivo JSON exportable para IndexedDB
 * @param {Array} results - Array de datos de tests
 * @param {string} sourceScript - Nombre del script que genera la exportación
 * @param {string} exportFile - Ruta del archivo de exportación
 */
function saveToDbExport(results, sourceScript = 'unknown', exportFile = DEFAULT_EXPORT_FILE) {
  const dbData = {
    lastUpdated: new Date().toISOString(),
    exportedBy: sourceScript,
    results: results
  };

  fs.writeFileSync(exportFile, JSON.stringify(dbData, null, 2));
  console.log(`📁 Resultados exportados a ${exportFile}`);
}

/**
 * Lee los resultados desde el archivo de exportación
 * @param {string} exportFile - Ruta del archivo de exportación
 * @returns {Array|null} - Array de resultados o null si hay error
 */
function loadFromDbExport(exportFile = DEFAULT_EXPORT_FILE) {
  if (!fs.existsSync(exportFile)) {
    console.error(`❌ No se encontró ${exportFile}`);
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
    return data.results || [];
  } catch (e) {
    console.error(`❌ Error al leer ${exportFile}:`, e.message);
    return null;
  }
}

/**
 * Añade nuevos resultados al archivo de exportación existente
 * @param {Array} newResults - Nuevos resultados a añadir
 * @param {string} sourceScript - Nombre del script que genera la exportación
 * @param {string} exportFile - Ruta del archivo de exportación
 */
function appendToDbExport(newResults, sourceScript = 'unknown', exportFile = DEFAULT_EXPORT_FILE) {
  const existing = loadFromDbExport(exportFile) || [];
  const merged = [...existing, ...newResults];

  const dbData = {
    lastUpdated: new Date().toISOString(),
    exportedBy: sourceScript,
    results: merged
  };

  fs.writeFileSync(exportFile, JSON.stringify(dbData, null, 2));
  console.log(`📁 ${newResults.length} nuevo(s) resultado(s) añadido(s) a ${exportFile}`);
}

module.exports = {
  saveToDbExport,
  loadFromDbExport,
  appendToDbExport,
  DEFAULT_EXPORT_FILE
};
