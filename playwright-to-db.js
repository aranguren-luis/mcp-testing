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

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_RESULTS_FILE = './test-results.json';
const DB_EXPORT_FILE = './test-results-db.json';
const PROJECTS_CONFIG_FILE = './playwright-projects.json';

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

function parseTestResults() {
  if (!fs.existsSync(TEST_RESULTS_FILE)) {
    console.error('❌ No se encontró test-results.json');
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(TEST_RESULTS_FILE, 'utf8'));
  } catch (e) {
    console.error('❌ Error al parsear test-results.json:', e.message);
    return null;
  }
}

function extractTestData(spec, test, result, report) {
  const passed = result.status === 'passed';
  const screenshots = result.attachments?.filter(a => a.contentType === 'image/png') || [];

  // Inferir pasos de las acciones del test
  const pasos = result.steps && result.steps.length > 0
    ? result.steps.map((s, i) => ({
        description: `${i + 1}. ${s.title}`,
        expected: '',
        data: '',
        passed: !s.error
      }))
    : [{ description: 'Ejecutar secuencia de commands', expected: '', data: '', passed }];

  // Inferir resultado esperado del nombre del test
  let resEsperado = 'El sistema debe procesar la solicitud sin errores.';
  const title = spec.title.toLowerCase();
  if (title.includes('login')) resEsperado = 'Autenticación exitosa y redirección al dashboard.';
  else if (title.includes('logout')) resEsperado = 'Cierre de sesión y redirección al login.';
  else if (title.includes('search')) resEsperado = 'Visualización de resultados relevantes.';
  else if (title.includes('create')) resEsperado = 'Creación exitosa del registro.';
  else if (title.includes('delete')) resEsperado = 'Eliminación exitosa del registro.';
  else if (title.includes('update') || title.includes('edit')) resEsperado = 'Actualización correcta de datos.';

  // Resultado obtenido
  let resObtenido = '';
  if (passed) {
    resObtenido = `Flujo completado. ${result.steps?.length || 0} validaciones exitosas.`;
  } else {
    const errorStep = result.steps?.find(s => s.error);
    resObtenido = `Fallo: ${errorStep?.title || 'Error desconocido'}. ${result.error?.message?.split('\n')[0] || ''}`;
  }

  // Determinar categoría
  let category = 'Bug (fallo)';
  if (passed) category = 'Test Case (caso de éxito)';

  return {
    id: `CP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    title: spec.title,
    category,
    frequency: 'Siempre',
    status: passed ? 'Cerrado' : 'Nuevo',
    followUp: !passed,
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
    executedFrom: 'Playwright',
    testFile: spec.location?.file || ''
  };
}

function saveToDbExport(results) {
  const dbData = {
    lastUpdated: new Date().toISOString(),
    results
  };
  fs.writeFileSync(DB_EXPORT_FILE, JSON.stringify(dbData, null, 2));
  console.log(`📁 Resultados exportados a ${DB_EXPORT_FILE}`);
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
  const report = parseTestResults();
  if (!report) return [];

  const allResults = [];
  const config = loadProjectsConfig();

  for (const suite of report.suites) {
    for (const spec of suite.specs) {
      for (const test of spec.tests) {
        const result = test.results[0];
        const testData = extractTestData(spec, test, result, report);

        // Asignar al proyecto si se especifica
        if (projectName) {
          testData.projectName = projectName;
          testData.projectId = projectId;
        }

        allResults.push(testData);
      }
    }
  }

  // Guardar en archivo de exportación (gestor.html puede importar esto)
  saveToDbExport(allResults);

  return allResults;
}

// ==================== SINCRONIZACIÓN CON YOUTRACK ====================

async function syncToYouTrack(results) {
  const { YOUTRACK_BASE_URL, YOUTRACK_TOKEN } = process.env;

  if (!YOUTRACK_BASE_URL || !YOUTRACK_TOKEN) {
    console.log('⚠️ YouTrack no configurado. Saltando sincronización.');
    return;
  }

  const axios = require('axios');
  const FormData = require('form-data');
  const counterFile = './counter.json';
  let counterData = fs.existsSync(counterFile) ? JSON.parse(fs.readFileSync(counterFile, 'utf8')) : { current: 100 };
  let counter = counterData.current;

  for (const test of results) {
    try {
      const descripcion = `
**${test.id} : ${test.title}**

**Categoría:** ${test.category}
**Estado:** ${test.status}
**Entorno:** ${test.env} | ${test.browser} | ${test.os}

**Pasos de Ejecución:**
${test.steps.map((s, i) => `${i + 1}. [${s.passed ? '✅' : '❌'}] ${s.description}`).join('\n')}

**Resultado Esperado:**
${test.expectedResults}

**Resultado Obtenido:**
${test.actualResult}

**Notas:**
${test.notes}

---
*Generado automáticamente por Playwright + MCP Testing*
      `;

      const issueRes = await axios.post(`${YOUTRACK_BASE_URL}/api/issues`, {
        project: { id: '0-0' },
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

      counter++;
    } catch (err) {
      console.error(`❌ Error sincronizando ${test.id}:`, err.response?.data?.error_description || err.message);
    }
  }

  fs.writeFileSync(counterFile, JSON.stringify({ current: counter }));
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
        const passed = results.filter(r => r.status === 'Cerrado').length;
        const failed = results.filter(r => r.status === 'Nuevo').length;
        console.log(`   📗 Pasados: ${passed}  |  📕 Fallidos: ${failed}`);

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
      saveToDbExport(results);
      console.log(`✅ Importados ${results.length} resultados`);
    } catch (err) {
      console.error('❌ Error importando:', err.message);
    }
    return;
  }

  showHelp();
}

main();
