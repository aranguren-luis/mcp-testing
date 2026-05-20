/**
 * playwright-to-db.js
 * Ejecuta tests de Playwright y guarda resultados en IndexedDB (compartido con gestor.html)
 * También sincroniza con YouTrack si está configurado.
 *
 * Uso:
 *   node playwright-to-db.js                    -> Ejecutar todos los tests
 *   node playwright-to-db.js tests/login.spec.js -> Ejecutar test específico
 *   node playwright-to-db.js --project=mi-proyecto -> Ejecutar tests de un proyecto
 */

require('dotenv').config();
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Módulos compartidos
const { extractTestData, parseTestResults, processAllResults } = require('./src/test-data-extractor');
const { formatYouTrackDescription, formatSummary } = require('./src/youtrack-formatter');
const { saveToDbExport } = require('./src/db-exporter');

const TEST_RESULTS_FILE = './test-results.json';
const DB_EXPORT_FILE = './test-results-db.json';
const PROJECTS_CONFIG_FILE = './playwright-projects.json';
const COUNTER_FILE = './counter.json';

// ==================== HELPERS ====================

function loadProjectsConfig() {
  if (fs.existsSync(PROJECTS_CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(PROJECTS_CONFIG_FILE, 'utf8'));
  }
  return { projects: [] };
}

function saveProjectsConfig(config) {
  fs.writeFileSync(PROJECTS_CONFIG_FILE, JSON.stringify(config, null, 2));
}

function ensureTestDir() {
  const testDir = path.join(__dirname, 'tests');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  return testDir;
}

function getTestFiles(projectName = null) {
  ensureTestDir();
  const testDir = path.join(__dirname, 'tests');

  if (projectName) {
    const projectTestDir = path.join(testDir, projectName);
    if (fs.existsSync(projectTestDir)) {
      return fs.readdirSync(projectTestDir)
        .filter(f => f.endsWith('.spec.js'))
        .map(f => path.join(projectTestDir, f));
    }
  }

  return fs.readdirSync(testDir)
    .filter(f => f.endsWith('.spec.js'))
    .map(f => path.join(testDir, f));
}

function getNextCounter() {
  if (fs.existsSync(COUNTER_FILE)) {
    const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
    return data.current || 100;
  }
  return 100;
}

function incrementCounter() {
  const current = getNextCounter();
  fs.writeFileSync(COUNTER_FILE, JSON.stringify({ current: current + 1 }));
  return current;
}

// ==================== EJECUCIÓN DE TESTS ====================

function runPlaywrightTests(testFiles = [], options = {}) {
  return new Promise((resolve, reject) => {
    const args = ['playwright', 'test'];

    if (testFiles.length > 0) {
      testFiles.forEach(f => args.push(f));
    }

    if (options.reporter) {
      args.push(`--reporter=${options.reporter}`);
    } else {
      args.push('--reporter=list,json');
    }

    if (options.project) {
      args.push(`--project=${options.project}`);
    }

    console.log(`🚀 Ejecutando: npx ${args.slice(1).join(' ')}`);

    const proc = spawn('npx', args, {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    });

    proc.on('close', (code) => {
      resolve(code);
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// ==================== PROCESAMIENTO Y GUARDADO ====================

function processAndSaveResults(projectName = null, projectId = null) {
  const report = parseTestResults(TEST_RESULTS_FILE);
  if (!report) return [];

  const options = {
    projectName,
    projectId,
    executedFrom: 'playwright-to-db.js'
  };

  const allResults = processAllResults(report, options);

  // Asignar IDs secuenciales usando el contador
  const startCounter = getNextCounter();
  allResults.forEach((test, index) => {
    test.id = `CP-${startCounter + index}`;
  });
  incrementCounter(allResults.length);

  // Guardar en archivo de exportación (gestor.html puede importar esto)
  saveToDbExport(allResults, 'playwright-to-db.js', DB_EXPORT_FILE);

  return allResults;
}

// ==================== SINCRONIZACIÓN CON YOUTRACK ====================

async function syncToYouTrack(results) {
  const { YOUTRACK_BASE_URL, YOUTRACK_TOKEN } = process.env;

  if (!YOUTRACK_BASE_URL || !YOUTRACK_TOKEN) {
    console.log('⚠️ YouTrack no configurado. Saltando sincronización.');
    return;
  }

  const PROJECT_ID = '0-0';

  for (const test of results) {
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

      console.log(`✅ ${test.id} sincronizado con YouTrack`);

      // Adjuntar screenshots
      for (const imgPath of test.images) {
        if (fs.existsSync(imgPath)) {
          const form = new FormData();
          form.append('file', fs.createReadStream(imgPath));
          await axios.post(`${YOUTRACK_BASE_URL}/api/issues/${issueRes.data.id}/attachments`, form, {
            headers: { ...form.getHeaders(), 'Authorization': `Bearer ${YOUTRACK_TOKEN}` }
          });
        }
      }
    } catch (err) {
      console.error(`❌ Error sincronizando ${test.id}:`, err.response?.data?.error_description || err.message);
    }
  }
}

// ==================== GESTIÓN DE PROYECTOS DE TESTS ====================

function listProjects() {
  const config = loadProjectsConfig();
  console.log('\n📁 Proyectos de Tests configurados:');
  if (config.projects.length === 0) {
    console.log('   No hay proyectos. Use --create-project para agregar.');
  } else {
    config.projects.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} (${p.testDir}) - Tests: ${p.testCount || 0}`);
    });
  }
  return config.projects;
}

function createProject(name, testDir = null) {
  const config = loadProjectsConfig();

  if (config.projects.find(p => p.name === name)) {
    console.error(`❌ Ya existe un proyecto con el nombre "${name}"`);
    return;
  }

  const projectTestDir = testDir || path.join(__dirname, 'tests', name);

  if (!fs.existsSync(projectTestDir)) {
    fs.mkdirSync(projectTestDir, { recursive: true });
    console.log(`📁 Creado directorio de tests: ${projectTestDir}`);
  }

  config.projects.push({
    name,
    testDir: projectTestDir,
    createdAt: new Date().toISOString(),
    testCount: 0
  });

  saveProjectsConfig(config);
  console.log(`✅ Proyecto "${name}" creado exitosamente`);
}

// ==================== INTERFAZ CLI ====================

function showHelp() {
  console.log(`
🔧 Playwright to DB - Ejecutor de Tests y Sincronizador

Uso:
  node playwright-to-db.js <comando> [opciones]

Comandos:
  run [archivo]       Ejecutar tests (todos o archivo específico)
  --project=<nombre>  Ejecutar tests de un proyecto específico
  list                 Listar proyectos configurados
  create <nombre>      Crear un nuevo proyecto de tests
  import <archivo>     Importar resultados desde JSON
  help                 Mostrar esta ayuda

Ejemplos:
  node playwright-to-db.js run                    # Ejecutar todos los tests
  node playwright-to-db.js run tests/login.spec.js # Ejecutar test específico
  node playwright-to-db.js --project=mi-proyecto   # Ejecutar tests del proyecto
  node playwright-to-db.js list                   # Ver proyectos
  node playwright-to-db.js create mi-proyecto      # Crear proyecto
  `);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help') {
    showHelp();
    return;
  }

  const command = args[0];

  // Parse project flag
  const projectFlag = args.find(a => a.startsWith('--project='));
  const projectName = projectFlag ? projectFlag.split('=')[1] : null;

  if (command === 'list') {
    listProjects();
    return;
  }

  if (command === 'create') {
    const name = args[1];
    if (!name) {
      console.error('❌ Debe especificar el nombre del proyecto');
      return;
    }
    createProject(name);
    return;
  }

  if (command === 'run' || projectName) {
    let testFiles = [];

    if (args[1] && !args[1].startsWith('--')) {
      // Test específico
      testFiles = [path.join(__dirname, args[1])];
    } else if (projectName) {
      // Tests del proyecto
      const config = loadProjectsConfig();
      const project = config.projects.find(p => p.name === projectName);
      if (!project) {
        console.error(`❌ No se encontró el proyecto "${projectName}"`);
        return;
      }
      testFiles = getTestFiles(projectName);
    }

    console.log(`\n🧪 Ejecutando ${testFiles.length} test(s)...\n`);

    try {
      await runPlaywrightTests(testFiles);

      console.log('\n📊 Procesando resultados...');
      const results = processAndSaveResults(projectName);

      console.log(`\n✅ ${results.length} resultado(s) procesado(s)`);

      if (results.length > 0) {
        const summary = formatSummary(results);
        console.log(`   📗 Pasados: ${summary.passed}  |  📕 Fallidos: ${summary.failed}  |  📈 Tasa de éxito: ${summary.passRate}%`);

        // Sincronizar con YouTrack
        await syncToYouTrack(results);
      }

      console.log(`\n💡 Para ver los resultados, abre gestor.html e importa desde ${DB_EXPORT_FILE}`);
    } catch (err) {
      console.error('❌ Error ejecutando tests:', err.message);
    }
    return;
  }

  if (command === 'import') {
    const file = args[1];
    if (!file) {
      console.error('❌ Debe especificar el archivo a importar');
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
      const results = Array.isArray(data) ? data : data.results || [];
      saveToDbExport(results, 'playwright-to-db.js (import)', DB_EXPORT_FILE);
      console.log(`✅ Importados ${results.length} resultados`);
    } catch (err) {
      console.error('❌ Error importando:', err.message);
    }
    return;
  }

  showHelp();
}

main();
