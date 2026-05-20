/**
 * server.js
 * Servidor local para el Gestor QA
 * Uso: npm start
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Servir archivos estáticos desde el directorio actual
app.use(express.static(__dirname));

// Servir también archivos del directorio padre (test-results-db.json, etc.)
app.use('/parent', express.static(path.join(__dirname, '..')));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API simple para importar archivos JSON del directorio padre
app.get('/api/test-results', (req, res) => {
  const fs = require('fs');
  const filePath = path.join(__dirname, '..', 'test-results-db.json');
  if (fs.existsSync(filePath)) {
    res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } else {
    res.json({ results: [], lastUpdated: null });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     Gestor QA - Servidor Local                           ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  🌐 http://localhost:${PORT}                               ║`);
  console.log(`║  📁 Directorio: ${__dirname}                   ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  Recursos disponibles:                                   ║');
  console.log('║    • index.html         - Interfaz principal            ║');
  console.log('║    • css/styles.css     - Estilos                       ║');
  console.log('║    • js/app.js          - Lógica de la aplicación       ║');
  console.log('║    • /parent/test-results-db.json - Resultados tests     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
