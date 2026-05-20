/**
 * src/index.js
 * Punto de entrada unificado para los módulos compartidos.
 * Permite imports convenientes: const { extractTestData } = require('./src');
 */

const testDataExtractor = require('./test-data-extractor');
const youtrackFormatter = require('./youtrack-formatter');
const dbExporter = require('./db-exporter');

module.exports = {
  // test-data-extractor
  extractTestData: testDataExtractor.extractTestData,
  extractSteps: testDataExtractor.extractSteps,
  inferExpectedResult: testDataExtractor.inferExpectedResult,
  inferActualResult: testDataExtractor.inferActualResult,
  determineCategory: testDataExtractor.determineCategory,
  determineStatus: testDataExtractor.determineStatus,
  parseTestResults: testDataExtractor.parseTestResults,
  processAllResults: testDataExtractor.processAllResults,

  // youtrack-formatter
  formatYouTrackDescription: youtrackFormatter.formatYouTrackDescription,
  formatShortDescription: youtrackFormatter.formatShortDescription,
  formatSummary: youtrackFormatter.formatSummary,

  // db-exporter
  saveToDbExport: dbExporter.saveToDbExport,
  loadFromDbExport: dbExporter.loadFromDbExport,
  appendToDbExport: dbExporter.appendToDbExport,
  DEFAULT_EXPORT_FILE: dbExporter.DEFAULT_EXPORT_FILE
};
