// ==================== VARIABLES GLOBALES ====================
let bugs = [];
let testCases = [];
let predefinedSteps = [];
let categories = [];
let projects = [];
let currentProject = null;
let currentImages = [];
let currentTestCaseSteps = []; // Ahora almacena objetos { description, expected, data }
let selectedTestCase = null;
let selectedPredefinedSteps = [];
let editingBugId = null;
let editingTestCaseId = null;
let testCaseImage = null;

let fieldValues = {
version: [], os: [], browser: [], resolution: [], device: [], build: []
};

const defaultCategories = ["Login","Navigation","Data Validation","Forms","Reports","Configuration","Other"];

// Detectar SO del navegador (para comandos)
const isWindows = navigator.userAgent.includes('Windows');

// Referencias a gráficos
let chartStatus = null;
let chartCategory = null;

// Instancia de Sortable para los pasos y para la tabla de casos
let stepsSortable = null;
let testCasesSortable = null;

// ==================== VARIABLES DE PLAYWRIGHT ====================
let playwrightTests = [];
let playwrightExecutions = [];
let playwrightProjects = [];

// ==================== CARGA DE TESTS DE PLAYWRIGHT ====================

async function loadPlaywrightTests() {
if (!currentProject) return;

playwrightTests = await db.playwrightTests.where('projectId').equals(currentProject.id).toArray();
playwrightExecutions = await db.playwrightExecutions.orderBy('executedAt').reverse().limit(50).toArray();

// Cargar proyectos de tests (directorios en /tests)
playwrightProjects = await loadPlaywrightProjectsFromStorage();

renderPlaywrightTestsTable();
renderPlaywrightExecutionHistory();
updateLastRunStats();
populatePlaywrightProjectFilter();
}

async function loadPlaywrightProjectsFromStorage() {
const stored = localStorage.getItem('playwright_projects');
return stored ? JSON.parse(stored) : [];
}

function renderPlaywrightTestsTable() {
const tbody = document.getElementById('playwrightTestsBody');
if (!tbody) return;

const filter = document.getElementById('playwrightProjectFilter')?.value || '';
const filtered = filter
    ? playwrightTests.filter(t => t.projectName === filter)
    : playwrightTests;

if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #7f8c8d;">No hay tests registrados. Importa resultados o ejecuta tests.</td></tr>';
    return;
}

tbody.innerHTML = filtered.map(test => {
    const exec = playwrightExecutions.find(e => e.testId === test.id);
    const statusClass = test.status === 'passed' ? 'status-passed' : (test.status === 'failed' ? 'status-failed' : 'status-not-executed');
    const statusText = test.status === 'passed' ? 'Pasado' : (test.status === 'failed' ? 'Fallido' : 'No ejecutado');

    return `
        <tr>
            <td><strong>${test.testFile || test.title}</strong></td>
            <td>${test.projectName || 'General'}</td>
            <td>${exec ? new Date(exec.executedAt).toLocaleString() : 'Nunca'}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>${exec ? exec.duration + 'ms' : '-'}</td>
            <td>
                <button class="btn-sm btn-secondary" onclick="viewPlaywrightTestDetails('${test.id}')"><i class="fas fa-eye"></i></button>
                <button class="btn-sm btn-danger" onclick="deletePlaywrightTest('${test.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `;
}).join('');
}

function renderPlaywrightExecutionHistory() {
const tbody = document.getElementById('executionHistoryBody');
if (!tbody) return;

if (playwrightExecutions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #7f8c8d;">Sin historial de ejecuciones</td></tr>';
    return;
}

tbody.innerHTML = playwrightExecutions.map(exec => {
    const test = playwrightTests.find(t => t.id === exec.testId);
    const statusClass = exec.status === 'passed' ? 'status-passed' : 'status-failed';

    return `
        <tr>
            <td>${new Date(exec.executedAt).toLocaleString()}</td>
            <td>${test?.testFile || test?.title || exec.testId}</td>
            <td><span class="status-badge ${statusClass}">${exec.status === 'passed' ? 'Pasado' : 'Fallido'}</span></td>
            <td>${exec.duration}ms</td>
            <td>${exec.errorCount || 0}</td>
        </tr>
    `;
}).join('');
}

function updateLastRunStats() {
const statsDiv = document.getElementById('lastRunStats');
if (!statsDiv) return;

if (playwrightExecutions.length === 0) {
    statsDiv.innerHTML = '<p style="color: #7f8c8d;">Sin ejecuciones registradas</p>';
    return;
}

const lastExec = playwrightExecutions[0];
const passed = playwrightExecutions.filter(e => e.status === 'passed').length;
const failed = playwrightExecutions.filter(e => e.status === 'failed').length;

statsDiv.innerHTML = `
    <div style="display: flex; justify-content: center; gap: 30px;">
        <div>
            <div style="font-size: 2rem; font-weight: bold; color: #27ae60;">${passed}</div>
            <div style="color: #7f8c8d;">Pasados</div>
        </div>
        <div>
            <div style="font-size: 2rem; font-weight: bold; color: #e74c3c;">${failed}</div>
            <div style="color: #7f8c8d;">Fallidos</div>
        </div>
        <div>
            <div style="font-size: 2rem; font-weight: bold; color: #3498db;">${lastExec.duration}ms</div>
            <div style="color: #7f8c8d;">Duración</div>
        </div>
    </div>
`;
}

function populatePlaywrightProjectFilter() {
const select = document.getElementById('playwrightProjectFilter');
if (!select) return;

const projects = [...new Set(playwrightTests.map(t => t.projectName).filter(Boolean))];
select.innerHTML = '<option value="">Todos los proyectos</option>' +
    projects.map(p => `<option value="${p}">${p}</option>`).join('');
}

async function importPlaywrightResults() {
try {
    const response = await fetch('./test-results-db.json');
    if (!response.ok) throw new Error('No se encontró test-results-db.json');

    const data = await response.json();
    const results = data.results || [];

    if (results.length === 0) {
        alert('No hay resultados para importar');
        return;
    }

    // Importar cada resultado como test de Playwright
    for (const result of results) {
        const testEntry = {
            id: result.id || `PW-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            title: result.title,
            testFile: result.testFile || '',
            projectId: currentProject?.id || null,
            projectName: result.projectName || 'General',
            status: result.status === 'Cerrado' ? 'passed' : 'failed',
            lastExecutedAt: result.createdDate || new Date().toISOString(),
            steps: result.steps || [],
            expectedResults: result.expectedResults || '',
            actualResult: result.actualResult || '',
            images: result.images || [],
            createdDate: new Date().toISOString()
        };

        await db.playwrightTests.put(testEntry);

        // Registrar ejecución
        await db.playwrightExecutions.add({
            testId: testEntry.id,
            executedAt: result.createdDate || new Date().toISOString(),
            status: testEntry.status,
            duration: 0,
            errorCount: testEntry.status === 'failed' ? 1 : 0
        });
    }

    alert(`✅ Importados ${results.length} resultados de tests`);
    await loadPlaywrightTests();
} catch (err) {
    console.error('Error importando:', err);
    alert('❌ Error al importar: ' + err.message);
}
}

function viewPlaywrightTestDetails(testId) {
const test = playwrightTests.find(t => t.id === testId);
if (!test) return;

const exec = playwrightExecutions.find(e => e.testId === testId);
const statusText = test.status === 'passed' ? '✅ Pasado' : '❌ Fallido';

alert(`Test: ${test.title}\n\nEstado: ${statusText}\nProyecto: ${test.projectName}\nArchivo: ${test.testFile}\n\nPasos:\n${(test.steps || []).map((s, i) => `${i + 1}. ${s.description}`).join('\n')}\n\nResultado Esperado:\n${test.expectedResults}\n\nResultado Obtenido:\n${test.actualResult}`);
}

async function deletePlaywrightTest(testId) {
if (!confirm('¿Eliminar este test?')) return;

await db.playwrightTests.delete(testId);
await db.playwrightExecutions.where('testId').equals(testId).delete();
await loadPlaywrightTests();
}

function refreshPlaywrightTests() {
loadPlaywrightTests();
}

async function runAllPlaywrightTests() {
alert(
    'Para ejecutar tests de Playwright:\n\n' +
    '1. Abre una terminal en esta carpeta\n' +
    '2. Ejecuta: node playwright-to-db.js run\n' +
    '3. Los resultados se importarán automáticamente aquí\n\n' +
    'También puedes ejecutar tests específicos:\n' +
    'node playwright-to-db.js run tests/mi-test.spec.js\n\n' +
    'O por proyecto:\n' +
    'node playwright-to-db.js --project=mi-proyecto'
);
}

// ==================== CONFIGURACIÓN DE INDEXEDDB CON DEXIE ====================
const db = new Dexie('QASystemDB');
db.version(2).stores({
bugs: 'id, projectId, createdDate, status, followUp',
testCases: 'id, projectId, status',
predefinedSteps: '++id, projectId, category',
categories: 'id, projectId',
fieldValues: 'projectId',
playwrightTests: 'id, projectId, projectName, status, executedAt',
playwrightExecutions: '++id, testId, executedAt, status'
});

db.open().catch(err => console.error('Error al abrir IndexedDB:', err));

// ==================== GESTIÓN DE PROYECTOS (localStorage) ====================
function loadProjects() { 
const saved = localStorage.getItem('bugReport_projects'); 
projects = saved ? JSON.parse(saved) : []; 
}
function saveProjects() { 
localStorage.setItem('bugReport_projects', JSON.stringify(projects)); 
}
function createDefaultProject() {
projects.push({ id: generateId(), name: "Proyecto Principal", description: "Proyecto por defecto", color: "#3498db", createdAt: new Date().toISOString(), isActive: true });
saveProjects();
}
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
function setActiveProject() {
let active = projects.find(p => p.isActive);
if (!active && projects.length > 0) { projects[0].isActive = true; active = projects[0]; saveProjects(); }
currentProject = active;
}

// ==================== CARGA Y GUARDADO CON INDEXEDDB ====================
async function loadAllData() {
if (!currentProject) return;

bugs = await db.bugs.where('projectId').equals(currentProject.id).toArray();
bugs = bugs.map(b => ({
    ...b,
    followUp: b.followUp || false,
    followUpDate: b.followUpDate || null
}));

testCases = await db.testCases.where('projectId').equals(currentProject.id).toArray();
// Migrar pasos antiguos (strings) a objetos
testCases = testCases.map(tc => {
    let steps = tc.steps || [];
    if (steps.length > 0 && typeof steps[0] === 'string') {
        steps = steps.map(s => ({ description: s }));
    }
    return {
        id: tc.id || '',
        title: tc.title || tc.objective || '',
        preconditions: tc.preconditions || '',
        steps: steps,
        expectedResults: tc.expectedResults || tc.objective || '',
        actualResult: tc.actualResult || '',
        status: tc.status || 'Not Executed',
        image: tc.image || null,
        usageCount: tc.usageCount || 0,
        creationDate: tc.creationDate || new Date().toISOString(),
        projectId: currentProject.id
    };
});

predefinedSteps = await db.predefinedSteps.where('projectId').equals(currentProject.id).toArray();

const catRecord = await db.categories.get({ id: 'categories', projectId: currentProject.id });
categories = catRecord ? catRecord.list : [...defaultCategories];

const fv = await db.fieldValues.get(currentProject.id);
fieldValues = fv || { version: [], os: [], browser: [], resolution: [], device: [], build: [] };

await migrateFromLocalStorageIfNeeded();

checkFollowUpReminders();
}

async function saveAllData() {
if (!currentProject) return;

await db.bugs.bulkPut(bugs);
await db.testCases.bulkPut(testCases);
await db.predefinedSteps.bulkPut(predefinedSteps);
await db.categories.put({ id: 'categories', projectId: currentProject.id, list: categories });
await db.fieldValues.put({ projectId: currentProject.id, ...fieldValues });
}

async function migrateFromLocalStorageIfNeeded() {
if (!currentProject) return;
const localBugs = JSON.parse(localStorage.getItem(`bugReport_bugs_${currentProject.id}`) || '[]');
if (localBugs.length > 0 && bugs.length === 0) {
    bugs = localBugs.map(b => ({ ...b, followUp: false, followUpDate: null }));
    await db.bugs.bulkPut(bugs);
}
const localTC = JSON.parse(localStorage.getItem(`testCases_${currentProject.id}`) || '[]');
if (localTC.length > 0 && testCases.length === 0) {
    testCases = localTC.map(tc => {
        let steps = tc.steps || [];
        if (steps.length > 0 && typeof steps[0] === 'string') {
            steps = steps.map(s => ({ description: s }));
        }
        return {
            ...tc,
            steps: steps
        };
    });
    await db.testCases.bulkPut(testCases);
}
const localSteps = JSON.parse(localStorage.getItem(`predefinedSteps_${currentProject.id}`) || '[]');
if (localSteps.length > 0 && predefinedSteps.length === 0) {
    predefinedSteps = localSteps;
    await db.predefinedSteps.bulkPut(predefinedSteps);
}
const localCats = localStorage.getItem(`categories_${currentProject.id}`);
if (localCats && categories.length === defaultCategories.length) {
    const parsed = JSON.parse(localCats);
    if (parsed.length) {
        categories = parsed;
        await db.categories.put({ id: 'categories', projectId: currentProject.id, list: categories });
    }
}
const localFV = localStorage.getItem(`fieldValues_${currentProject.id}`);
if (localFV) {
    fieldValues = JSON.parse(localFV);
    await db.fieldValues.put({ projectId: currentProject.id, ...fieldValues });
}
}

// ==================== VALORES REUTILIZABLES ====================
function addFieldValue(field, value) {
if (!value || value.trim() === '') return;
value = value.trim();
if (!fieldValues[field]) fieldValues[field] = [];
if (!fieldValues[field].includes(value)) {
    fieldValues[field].push(value);
    fieldValues[field].sort((a,b) => a.localeCompare(b));
    saveAllData();
}
}
function populateSelectFromFieldValues(selectId, fieldName, currentValue) {
const select = document.getElementById(selectId);
if (!select) return;
const selected = currentValue || select.value;
while (select.options.length > 1) select.remove(1);
if (!select.querySelector('option[value="__new__"]')) {
    const opt = document.createElement('option');
    opt.value = '__new__';
    opt.textContent = '➕ Agregar nuevo...';
    select.appendChild(opt);
}
const values = fieldValues[fieldName] || [];
values.forEach(val => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val;
    select.appendChild(opt);
});
if (selected && selected !== '__new__') {
    if (Array.from(select.options).some(o => o.value === selected)) select.value = selected;
    else select.value = '';
}
}
function handleNewValueSelect(select, fieldName) {
if (select.value === '__new__') {
    const newValue = prompt(`Ingrese nuevo valor para ${fieldName}:`);
    if (newValue && newValue.trim() !== '') {
        addFieldValue(fieldName, newValue.trim());
        populateSelectFromFieldValues(select.id, fieldName, newValue.trim());
        select.value = newValue.trim();
    } else {
        select.value = select.dataset.previousValue || '';
    }
}
select.dataset.previousValue = select.value;
}
function populateAllEnvironmentSelects() {
populateSelectFromFieldValues('bugVersion','version');
populateSelectFromFieldValues('bugOS','os');
populateSelectFromFieldValues('bugBrowser','browser');
populateSelectFromFieldValues('bugResolution','resolution');
populateSelectFromFieldValues('bugDevice','device');
populateSelectFromFieldValues('bugBuild','build');
}

// ==================== FORMULARIO DE REPORTE DE BUGS ====================
function setupBugReportForm() {
const formTabs = document.querySelectorAll('.form-tab');
formTabs.forEach(tab => tab.addEventListener('click', function() {
    formTabs.forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(this.getAttribute('data-tab')).classList.add('active');
}));
const uploadArea = document.getElementById('imageUploadArea');
const imageInput = document.getElementById('imageInput');
uploadArea.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', e => handleImageFiles(e.target.files));
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.style.backgroundColor = 'rgba(52,152,219,0.15)'; });
uploadArea.addEventListener('dragleave', () => { uploadArea.style.backgroundColor = 'rgba(52,152,219,0.05)'; });
uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.style.backgroundColor = 'rgba(52,152,219,0.05)';
    handleImageFiles(e.dataTransfer.files);
});
['bugVersion','bugOS','bugBrowser','bugResolution','bugDevice','bugBuild'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) {
        sel.addEventListener('change', function() { handleNewValueSelect(this, id.replace('bug','').toLowerCase()); });
        sel.dataset.previousValue = sel.value;
    }
});
document.getElementById('useTestCaseBtn').addEventListener('click', openTestCaseModal);
document.getElementById('bugForm').addEventListener('submit', e => {
    e.preventDefault();
    editingBugId ? updateBugReport() : createBugReport();
});
document.getElementById('clearForm').addEventListener('click', clearBugForm);
document.getElementById('cancelEdit').addEventListener('click', cancelEdit);
}

function handleImageFiles(files) {
const remaining = 5 - currentImages.length;
const toAdd = Math.min(files.length, remaining);
if (remaining <= 0) { showNotification('Máximo 5 imágenes', 'warning'); return; }
for (let i = 0; i < toAdd; i++) {
    const file = files[i];
    if (!file.type.match('image.*')) { showNotification('Solo imágenes', 'warning'); continue; }
    if (file.size > 5 * 1024 * 1024) { showNotification(`${file.name} supera 5MB`, 'warning'); continue; }
    const reader = new FileReader();
    reader.onload = (e) => {
        currentImages.push({ id: Date.now() + i, name: file.name, data: e.target.result });
        updateImagePreview();
    };
    reader.readAsDataURL(file);
}
document.getElementById('imageInput').value = '';
}

function updateImagePreview() {
const container = document.getElementById('imagePreviewContainer');
container.innerHTML = '';
currentImages.forEach(img => {
    const div = document.createElement('div');
    div.className = 'image-preview';
    div.innerHTML = `<img src="${img.data}" alt="${img.name}"><button class="remove-image" onclick="removeImage(${img.id})"><i class="fas fa-times"></i></button>`;
    container.appendChild(div);
});
const p = document.querySelector('#imageUploadArea p');
const span = document.querySelector('#imageUploadArea span');
if (p && span) {
    if (currentImages.length === 0) { p.textContent = 'Haz clic para seleccionar imágenes'; span.textContent = 'o arrastra y suelta aquí (o pega con Ctrl+V)'; }
    else { p.textContent = `${currentImages.length} imagen(es) seleccionada(s)`; span.textContent = 5 - currentImages.length > 0 ? `Puedes agregar ${5 - currentImages.length} más` : 'Límite alcanzado'; }
}
}
window.removeImage = function(id) { currentImages = currentImages.filter(img => img.id !== id); updateImagePreview(); };

async function createBugReport() {
const followUpCheck = document.getElementById('bugFollowUp').checked;
const bug = {
    id: Date.now(),
    title: document.getElementById('bugTitle').value.trim(),
    category: document.getElementById('bugCategory').value,
    frequency: document.getElementById('bugFrequency').value,
    steps: document.getElementById('bugSteps').value.trim(),
    expected: document.getElementById('bugExpected').value.trim(),
    actual: document.getElementById('bugActual').value.trim(),
    notes: document.getElementById('bugNotes').value.trim(),
    status: document.getElementById('bugStatus').value,
    version: document.getElementById('bugVersion').value,
    os: document.getElementById('bugOS').value,
    browser: document.getElementById('bugBrowser').value,
    environment: document.getElementById('bugEnv').value,
    resolution: document.getElementById('bugResolution').value,
    device: document.getElementById('bugDevice').value,
    build: document.getElementById('bugBuild').value,
    images: [...currentImages],
    createdDate: new Date().toISOString(),
    updatedDate: new Date().toISOString(),
    projectId: currentProject.id,
    followUp: followUpCheck,
    followUpDate: followUpCheck ? new Date().toISOString() : null
};
if (!bug.title || !bug.category || !bug.frequency || !bug.steps || !bug.expected || !bug.actual || !bug.version || !bug.os || !bug.browser || !bug.environment) {
    showNotification('Complete todos los campos requeridos', 'warning'); return;
}
bugs.push(bug);
addFieldValue('version', bug.version);
addFieldValue('os', bug.os);
addFieldValue('browser', bug.browser);
addFieldValue('resolution', bug.resolution);
addFieldValue('device', bug.device);
addFieldValue('build', bug.build);
await saveAllData();
updateBugList();
clearBugForm();
populateAllEnvironmentSelects();
showNotification('Reporte creado', 'success');
updateCharts();
}

function editBug(id) {
const bug = bugs.find(b => b.id === id);
if (!bug) return;
editingBugId = id;
document.getElementById('editingIndicator').style.display = 'flex';
document.getElementById('editingBugId').textContent = `#${id.toString().slice(-6)}`;
document.getElementById('submitBugBtn').innerHTML = '<i class="fas fa-save"></i> Actualizar Reporte';
document.getElementById('submitBugBtn').classList.remove('btn-primary');
document.getElementById('submitBugBtn').classList.add('btn-warning');
document.getElementById('cancelEdit').style.display = 'block';
document.getElementById('bugTitle').value = bug.title;
document.getElementById('bugCategory').value = bug.category;
document.getElementById('bugFrequency').value = bug.frequency;
document.getElementById('bugStatus').value = bug.status;
document.getElementById('bugSteps').value = bug.steps;
document.getElementById('bugExpected').value = bug.expected;
document.getElementById('bugActual').value = bug.actual;
document.getElementById('bugNotes').value = bug.notes || '';
document.getElementById('bugFollowUp').checked = bug.followUp || false;
populateSelectFromFieldValues('bugVersion','version', bug.version);
populateSelectFromFieldValues('bugOS','os', bug.os);
populateSelectFromFieldValues('bugBrowser','browser', bug.browser);
document.getElementById('bugEnv').value = bug.environment;
populateSelectFromFieldValues('bugResolution','resolution', bug.resolution);
populateSelectFromFieldValues('bugDevice','device', bug.device);
populateSelectFromFieldValues('bugBuild','build', bug.build);
currentImages = bug.images ? [...bug.images] : [];
updateImagePreview();
document.getElementById('editingBugIdField').value = id;
document.querySelector('[data-tab="tab-basic"]').click();
showNotification('Modo edición activado', 'info');
}
window.editBug = editBug;

async function updateBugReport() {
if (!editingBugId) return;
const index = bugs.findIndex(b => b.id === editingBugId);
if (index === -1) return;
const followUpCheck = document.getElementById('bugFollowUp').checked;
bugs[index] = {
    ...bugs[index],
    title: document.getElementById('bugTitle').value.trim(),
    category: document.getElementById('bugCategory').value,
    frequency: document.getElementById('bugFrequency').value,
    steps: document.getElementById('bugSteps').value.trim(),
    expected: document.getElementById('bugExpected').value.trim(),
    actual: document.getElementById('bugActual').value.trim(),
    notes: document.getElementById('bugNotes').value.trim(),
    status: document.getElementById('bugStatus').value,
    version: document.getElementById('bugVersion').value,
    os: document.getElementById('bugOS').value,
    browser: document.getElementById('bugBrowser').value,
    environment: document.getElementById('bugEnv').value,
    resolution: document.getElementById('bugResolution').value,
    device: document.getElementById('bugDevice').value,
    build: document.getElementById('bugBuild').value,
    images: [...currentImages],
    updatedDate: new Date().toISOString(),
    followUp: followUpCheck,
    followUpDate: followUpCheck ? (bugs[index].followUpDate || new Date().toISOString()) : null
};
addFieldValue('version', bugs[index].version);
addFieldValue('os', bugs[index].os);
addFieldValue('browser', bugs[index].browser);
addFieldValue('resolution', bugs[index].resolution);
addFieldValue('device', bugs[index].device);
addFieldValue('build', bugs[index].build);
await saveAllData();
updateBugList();
clearBugForm();
cancelEdit();
showNotification('Reporte actualizado', 'success');
updateCharts();
}

function cancelEdit() {
editingBugId = null;
document.getElementById('editingIndicator').style.display = 'none';
document.getElementById('submitBugBtn').innerHTML = '<i class="fas fa-plus-circle"></i> Crear Reporte';
document.getElementById('submitBugBtn').classList.remove('btn-warning');
document.getElementById('submitBugBtn').classList.add('btn-primary');
document.getElementById('cancelEdit').style.display = 'none';
document.getElementById('editingBugIdField').value = '';
clearBugForm();
showNotification('Edición cancelada', 'info');
}

function clearBugForm() {
document.getElementById('bugForm').reset();
document.getElementById('bugStatus').value = 'Nuevo';
document.getElementById('bugCategory').value = '';
document.getElementById('bugEnv').value = 'Testing';
document.getElementById('bugFollowUp').checked = false;
currentImages = [];
updateImagePreview();
if (editingBugId) cancelEdit();
document.querySelector('[data-tab="tab-basic"]').click();
populateAllEnvironmentSelects();
}

async function deleteBug(id) {
if (confirm('¿Eliminar reporte?')) {
    if (editingBugId === id) cancelEdit();
    bugs = bugs.filter(b => b.id !== id);
    await saveAllData();
    updateBugList();
    showNotification('Reporte eliminado', 'success');
    updateCharts();
}
}
window.deleteBug = deleteBug;

function toggleFollowUp(id) {
const bug = bugs.find(b => b.id === id);
if (bug) {
    bug.followUp = !bug.followUp;
    bug.followUpDate = bug.followUp ? new Date().toISOString() : null;
    saveAllData();
    updateBugList();
    showNotification(bug.followUp ? 'Seguimiento activado' : 'Seguimiento desactivado', 'info');
}
}
window.toggleFollowUp = toggleFollowUp;

function updateBugList() {
const preview = document.getElementById('bugsPreview');
const empty = document.getElementById('emptyState');
const total = document.getElementById('totalBugs');
if (!preview || !empty || !total) return;
if (bugs.length === 0) { empty.style.display = 'block'; preview.style.display = 'none'; }
else {
    empty.style.display = 'none'; preview.style.display = 'grid';
    bugs.sort((a,b) => new Date(b.createdDate) - new Date(a.createdDate));
    preview.innerHTML = '';
    bugs.forEach(bug => {
        let statusClass = bug.status === 'Asignado' ? 'status-assigned' : bug.status === 'Resuelto' ? 'status-fixed' : bug.status === 'Cerrado' ? 'status-closed' : 'status-new';
        let categoryClass = '', categoryText = '';
        if (bug.category === 'Bug (fallo)') { categoryClass = 'category-bug'; categoryText = 'Bug'; }
        else if (bug.category === 'Test Case (caso de éxito)') { categoryClass = 'category-test-case'; categoryText = 'Test Case'; }
        else if (bug.category === 'Exploratorio') { categoryClass = 'category-exploratory'; categoryText = 'Exploratorio'; }
        else if (bug.category === 'Mejora') { categoryClass = 'category-improvement'; categoryText = 'Mejora'; }
        const date = new Date(bug.createdDate).toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
        let imagesHTML = '';
        if (bug.images && bug.images.length) {
            imagesHTML = `<div class="bug-section"><div class="section-heading">Evidencia (${bug.images.length})</div><div class="bug-images">${bug.images.map(img => `<img src="${img.data}" class="bug-image" onclick="showImageInModal('${img.data}')">`).join('')}</div></div>`;
        }
        const followUpIcon = bug.followUp ? 'fa-bell text-warning' : 'fa-bell';
        const followUpClass = bug.followUp ? 'active' : '';
        const el = document.createElement('div');
        el.className = 'bug-item';
        el.innerHTML = `
            <div class="bug-header">
                <div>
                    <div class="bug-title">${bug.title} ${categoryText ? `<span class="category-badge ${categoryClass}">${categoryText}</span>` : ''}</div>
                    <div class="bug-meta">
                        <div class="meta-item"><span class="meta-label">ID:</span> #${bug.id.toString().slice(-6)}</div>
                        <div class="meta-item"><span class="meta-label">Fecha:</span> ${date}</div>
                        <div class="meta-item"><span class="meta-label">Frecuencia:</span> ${bug.frequency}</div>
                        ${bug.category ? `<div class="meta-item"><span class="meta-label">Categoría:</span> ${bug.category}</div>` : ''}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 5px;">
                    <div class="bug-status-badge ${statusClass}">${bug.status}</div>
                    <button class="follow-up-btn ${followUpClass}" onclick="toggleFollowUp(${bug.id})" title="Activar seguimiento"><i class="fas ${followUpIcon}"></i></button>
                </div>
            </div>
            <div class="bug-section"><div class="section-heading">Información del Entorno</div><div class="bug-meta"><div class="meta-item"><span class="meta-label">Versión:</span> ${bug.version}</div><div class="meta-item"><span class="meta-label">SO:</span> ${bug.os}</div><div class="meta-item"><span class="meta-label">Navegador:</span> ${bug.browser}</div><div class="meta-item"><span class="meta-label">Entorno:</span> ${bug.environment}</div>${bug.device ? `<div class="meta-item"><span class="meta-label">Dispositivo:</span> ${bug.device}</div>` : ''}${bug.resolution ? `<div class="meta-item"><span class="meta-label">Resolución:</span> ${bug.resolution}</div>` : ''}${bug.build ? `<div class="meta-item"><span class="meta-label">Build:</span> ${bug.build}</div>` : ''}</div></div>
            <div class="bug-section"><div class="section-heading">Pasos para Reproducir</div><div class="section-content">${bug.steps}</div></div>
            <div style="display:flex; gap:10px;"><div class="bug-section" style="flex:1;"><div class="section-heading">Resultado Esperado</div><div class="section-content">${bug.expected}</div></div><div class="bug-section" style="flex:1;"><div class="section-heading">Resultado Actual</div><div class="section-content">${bug.actual}</div></div></div>
            ${bug.notes ? `<div class="bug-section"><div class="section-heading">Notas Adicionales</div><div class="section-content">${bug.notes}</div></div>` : ''}
            ${imagesHTML}
            <div class="bug-actions">
                <button class="btn-warning bug-action-btn" onclick="editBug(${bug.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-danger bug-action-btn" onclick="deleteBug(${bug.id})"><i class="fas fa-trash"></i> Eliminar</button>
            </div>
        `;
        preview.appendChild(el);
    });
}
total.textContent = bugs.length;
}
window.showImageInModal = function(src) {
const modal = document.getElementById('imageModal');
document.getElementById('modalImage').src = src;
modal.style.display = 'flex';
};

// ==================== FUNCIONES PARA ESTADÍSTICAS Y RECORDATORIOS ====================
function updateCharts() {
if (!currentProject) return;

const statuses = ['Nuevo', 'Asignado', 'Resuelto', 'Cerrado'];
const statusCounts = statuses.map(s => bugs.filter(b => b.status === s).length);

const categoryMap = new Map();
bugs.forEach(b => {
    const cat = b.category || 'Sin categoría';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
});
const categoriesLabels = Array.from(categoryMap.keys());
const categoriesData = Array.from(categoryMap.values());

if (chartStatus) chartStatus.destroy();
if (chartCategory) chartCategory.destroy();

const ctxStatus = document.getElementById('chartBugsByStatus')?.getContext('2d');
const ctxCategory = document.getElementById('chartBugsByCategory')?.getContext('2d');

if (ctxStatus) {
    chartStatus = new Chart(ctxStatus, {
        type: 'pie',
        data: {
            labels: statuses,
            datasets: [{
                data: statusCounts,
                backgroundColor: ['#3498db', '#f39c12', '#27ae60', '#7f8c8d'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

if (ctxCategory) {
    chartCategory = new Chart(ctxCategory, {
        type: 'pie',
        data: {
            labels: categoriesLabels,
            datasets: [{
                data: categoriesData,
                backgroundColor: ['#3498db', '#27ae60', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#2c3e50', '#95a5a6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}
}

function checkFollowUpReminders() {
const now = new Date();
const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
const reminders = bugs.filter(b => 
    b.followUp && 
    b.updatedDate && 
    new Date(b.updatedDate) < sevenDaysAgo
);

if (reminders.length > 0) {
    const titles = reminders.map(b => `- ${b.title}`).join('\n');
    showNotification(`🔔 Tienes ${reminders.length} bug(s) en seguimiento sin actualizar en más de 7 días:\n${titles}`, 'warning');
}
}

// ==================== ATAJOS DE TECLADO Y PEGAR IMAGEN ====================
function setupKeyboardShortcuts() {
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        if (document.getElementById('bug-report').classList.contains('active')) {
            clearBugForm();
            document.getElementById('bugTitle').focus();
            showNotification('Nuevo reporte listo', 'info');
        } else {
            document.querySelector('[data-tab="bug-report"]').click();
            clearBugForm();
            document.getElementById('bugTitle').focus();
            showNotification('Nuevo reporte listo', 'info');
        }
    }
    
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        if (document.getElementById('bug-report').classList.contains('active')) {
            document.getElementById('bugForm').dispatchEvent(new Event('submit'));
        } else {
            showNotification('Debes estar en la pestaña de reportes', 'warning');
        }
    }
});
}

function setupPasteImage() {
document.addEventListener('paste', function(e) {
    if (!document.getElementById('bug-report').classList.contains('active')) return;
    
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            if (file) {
                if (currentImages.length >= 5) {
                    showNotification('Máximo 5 imágenes', 'warning');
                    return;
                }
                if (file.size > 5 * 1024 * 1024) {
                    showNotification('La imagen supera 5MB', 'warning');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    currentImages.push({ id: Date.now(), name: 'Pegado desde portapapeles', data: ev.target.result });
                    updateImagePreview();
                    showNotification('Imagen pegada correctamente', 'success');
                };
                reader.readAsDataURL(file);
            }
            break;
        }
    }
});
}

// ==================== NUEVA GESTIÓN DE PASOS DE PRUEBA CON DRAG & DROP ====================
function renderStepsList() {
const container = document.getElementById('testCaseStepsContainer');
if (!container) return;

// Destruir instancia anterior de Sortable si existe
if (stepsSortable) {
    stepsSortable.destroy();
    stepsSortable = null;
}

if (currentTestCaseSteps.length === 0) {
    container.innerHTML = '<div class="step-empty">No hay pasos agregados. Usa los botones para añadir.</div>';
    return;
}

let html = '';
currentTestCaseSteps.forEach((step, index) => {
    const desc = step.description || '';
    const expected = step.expected ? `<div class="step-expected"><strong>Esperado:</strong> ${step.expected}</div>` : '';
    const data = step.data ? `<div class="step-data"><strong>Datos:</strong> ${step.data}</div>` : '';
    html += `
        <div class="step-card" data-index="${index}">
            <div class="drag-handle"><i class="fas fa-grip-vertical"></i></div>
            <div class="step-content">
                <div class="step-header">
                    <span class="step-number">Paso ${index + 1}</span>
                    <div class="step-actions">
                        <button class="move-up" title="Subir" ${index === 0 ? 'disabled' : ''}><i class="fas fa-arrow-up"></i></button>
                        <button class="move-down" title="Bajar" ${index === currentTestCaseSteps.length - 1 ? 'disabled' : ''}><i class="fas fa-arrow-down"></i></button>
                        <button class="edit-step" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="delete-step" title="Eliminar"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="step-description">${desc}</div>
                ${expected}
                ${data}
            </div>
        </div>
    `;
});
container.innerHTML = html;

// Asignar eventos a los botones
container.querySelectorAll('.move-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.step-card');
        const index = parseInt(card.dataset.index);
        if (index > 0) {
            [currentTestCaseSteps[index - 1], currentTestCaseSteps[index]] = [currentTestCaseSteps[index], currentTestCaseSteps[index - 1]];
            renderStepsList(); // re-renderiza para actualizar índices y números
        }
    });
});

container.querySelectorAll('.move-down').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.step-card');
        const index = parseInt(card.dataset.index);
        if (index < currentTestCaseSteps.length - 1) {
            [currentTestCaseSteps[index], currentTestCaseSteps[index + 1]] = [currentTestCaseSteps[index + 1], currentTestCaseSteps[index]];
            renderStepsList();
        }
    });
});

container.querySelectorAll('.edit-step').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.step-card');
        const index = parseInt(card.dataset.index);
        openEditStepModal(index);
    });
});

container.querySelectorAll('.delete-step').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = e.target.closest('.step-card');
        const index = parseInt(card.dataset.index);
        if (confirm('¿Eliminar este paso?')) {
            currentTestCaseSteps.splice(index, 1);
            renderStepsList();
        }
    });
});

// Inicializar Sortable para arrastrar y soltar
stepsSortable = new Sortable(container, {
    animation: 150,
    handle: '.drag-handle',
    onEnd: function(evt) {
        // El DOM ya ha sido reordenado por Sortable, pero debemos actualizar el array
        const oldIndex = evt.oldIndex;
        const newIndex = evt.newIndex;
        
        // Reordenar el array
        const movedItem = currentTestCaseSteps.splice(oldIndex, 1)[0];
        currentTestCaseSteps.splice(newIndex, 0, movedItem);
        
        // Actualizar los números de paso en el DOM
        const cards = container.querySelectorAll('.step-card');
        cards.forEach((card, idx) => {
            card.dataset.index = idx;
            const numberSpan = card.querySelector('.step-number');
            if (numberSpan) numberSpan.textContent = `Paso ${idx + 1}`;
        });
    }
});
}

function openEditStepModal(index) {
const step = currentTestCaseSteps[index];
document.getElementById('customStepDescription').value = step.description || '';
document.getElementById('customStepExpected').value = step.expected || '';
document.getElementById('customStepData').value = step.data || '';
document.getElementById('saveAsPredefined').checked = false;
document.getElementById('customStepCategoryContainer').style.display = 'none';
document.getElementById('editingStepIndex').value = index;
document.getElementById('customStepModal').style.display = 'flex';
updateCategoriesSelect('customStepCategory');
}

// Modificar el setup del modal de paso personalizado
function setupCustomStepModal() {
document.getElementById('saveAsPredefined').addEventListener('change', function() {
    document.getElementById('customStepCategoryContainer').style.display = this.checked ? 'block' : 'none';
});

document.getElementById('addCustomStepBtnModal').addEventListener('click', function() {
    const desc = document.getElementById('customStepDescription').value.trim();
    if (!desc) { showNotification('La descripción es obligatoria', 'warning'); return; }
    
    const expected = document.getElementById('customStepExpected').value.trim() || undefined;
    const data = document.getElementById('customStepData').value.trim() || undefined;
    const save = document.getElementById('saveAsPredefined').checked;
    const editingIndex = parseInt(document.getElementById('editingStepIndex').value);
    
    let stepObj = { description: desc };
    if (expected) stepObj.expected = expected;
    if (data) stepObj.data = data;
    
    if (editingIndex >= 0) {
        // Editar paso existente
        currentTestCaseSteps[editingIndex] = stepObj;
    } else {
        // Nuevo paso
        currentTestCaseSteps.push(stepObj);
    }
    
    if (save) {
        const cat = document.getElementById('customStepCategory').value;
        const finalCat = cat || "Other";
        // Verificar si ya existe un paso predefinido con la misma descripción
        let existing = predefinedSteps.find(s => s.description.toLowerCase() === desc.toLowerCase());
        if (!existing) {
            const newStep = {
                id: predefinedSteps.length > 0 ? Math.max(...predefinedSteps.map(s => s.id)) + 1 : 1,
                description: desc,
                category: finalCat,
                usageCount: 0,
                createdAt: new Date().toISOString(),
                projectId: currentProject.id
            };
            predefinedSteps.push(newStep);
            saveAllData();
            updatePredefinedStepsList();
            showNotification('Paso guardado en biblioteca', 'success');
        } else {
            showNotification('Ya existe un paso predefinido con esa descripción', 'warning');
        }
    }
    
    renderStepsList();
    document.getElementById('customStepModal').style.display = 'none';
    document.getElementById('customStepDescription').value = '';
    document.getElementById('customStepExpected').value = '';
    document.getElementById('customStepData').value = '';
    document.getElementById('saveAsPredefined').checked = false;
    document.getElementById('customStepCategoryContainer').style.display = 'none';
    document.getElementById('editingStepIndex').value = '-1';
});

document.getElementById('closeCustomStepModalBtn').addEventListener('click', () => {
    document.getElementById('customStepModal').style.display = 'none';
    document.getElementById('customStepDescription').value = '';
    document.getElementById('customStepExpected').value = '';
    document.getElementById('customStepData').value = '';
    document.getElementById('saveAsPredefined').checked = false;
    document.getElementById('customStepCategoryContainer').style.display = 'none';
    document.getElementById('editingStepIndex').value = '-1';
});

document.getElementById('addCategoryBtnModal').addEventListener('click', function() {
    const catSelect = document.getElementById('customStepCategory');
    const newCat = prompt('Ingrese nueva categoría:');
    if (newCat && newCat.trim()) {
        addCategory(newCat.trim());
        updateCategoriesSelect('customStepCategory');
        catSelect.value = newCat.trim();
    }
});
}

// Actualizar función de caso de prueba para usar la nueva estructura
function setupTestCaseForm() {
const tabs = document.querySelectorAll('.test-case-form-tab');
tabs.forEach(tab => tab.addEventListener('click', function() {
    tabs.forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    document.querySelectorAll('.test-case-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(this.getAttribute('data-tab')).classList.add('active');
    if (this.getAttribute('data-tab') === 'view-test-cases') renderTestCasesTable();
}));

const uploadArea = document.getElementById('testCaseImageUploadArea');
const imageInput = document.getElementById('testCaseImageInput');
uploadArea.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', e => handleTestCaseImageFile(e.target.files[0]));
uploadArea.addEventListener('dragover', e => e.preventDefault());
uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    handleTestCaseImageFile(e.dataTransfer.files[0]);
});

document.getElementById('addPredefinedStepBtn').addEventListener('click', openTestCaseModal);
document.getElementById('addCustomStepBtn').addEventListener('click', () => {
    document.getElementById('editingStepIndex').value = '-1';
    document.getElementById('customStepDescription').value = '';
    document.getElementById('customStepExpected').value = '';
    document.getElementById('customStepData').value = '';
    document.getElementById('saveAsPredefined').checked = false;
    document.getElementById('customStepCategoryContainer').style.display = 'none';
    document.getElementById('customStepModal').style.display = 'flex';
    updateCategoriesSelect('customStepCategory');
});

document.getElementById('testCaseForm').addEventListener('submit', e => {
    e.preventDefault();
    editingTestCaseId ? updateTestCase() : saveTestCase();
});

document.getElementById('clearTestCaseForm').addEventListener('click', clearTestCaseForm);
document.getElementById('cancelTestCaseEdit').addEventListener('click', cancelTestCaseEdit);
document.getElementById('searchTestCases').addEventListener('input', filterTestCasesTable);
}

function handleTestCaseImageFile(file) {
if (!file) return;
if (!file.type.match('image.*')) { showNotification('Solo imágenes', 'warning'); return; }
if (file.size > 5 * 1024 * 1024) { showNotification('Imagen supera 5MB', 'warning'); return; }
const reader = new FileReader();
reader.onload = e => {
    testCaseImage = { name: file.name, data: e.target.result };
    updateTestCaseImagePreview();
};
reader.readAsDataURL(file);
document.getElementById('testCaseImageInput').value = '';
}

function updateTestCaseImagePreview() {
const container = document.getElementById('testCaseImagePreviewContainer');
container.innerHTML = '';
if (testCaseImage) {
    const div = document.createElement('div');
    div.className = 'image-preview';
    div.innerHTML = `<img src="${testCaseImage.data}" alt="${testCaseImage.name}"><button class="remove-image" onclick="removeTestCaseImage()"><i class="fas fa-times"></i></button>`;
    container.appendChild(div);
}
}
window.removeTestCaseImage = function() { testCaseImage = null; updateTestCaseImagePreview(); };

async function saveTestCase() {
const id = document.getElementById('testCaseId').value.trim();
const title = document.getElementById('testCaseTitle').value.trim();
const expected = document.getElementById('testCaseExpected').value.trim();
if (!id || !title || !expected) {
    showNotification('ID, Título y Resultado Esperado son obligatorios', 'warning');
    return;
}
if (testCases.some(tc => tc.id === id) && !editingTestCaseId) {
    showNotification(`Ya existe un caso con ID ${id}`, 'warning');
    return;
}

// Validar que los pasos tengan al menos descripción
const validSteps = currentTestCaseSteps.filter(s => s.description && s.description.trim() !== '');
if (validSteps.length === 0) {
    showNotification('Debe agregar al menos un paso con descripción', 'warning');
    return;
}

const testCase = {
    id: id,
    title: title,
    preconditions: document.getElementById('testCasePreconditions').value.trim(),
    steps: validSteps, // guardamos como objetos
    expectedResults: expected,
    actualResult: document.getElementById('testCaseActual').value.trim(),
    status: document.getElementById('testCaseStatus').value,
    image: testCaseImage,
    usageCount: 0,
    creationDate: new Date().toISOString(),
    projectId: currentProject.id
};

if (editingTestCaseId) {
    const index = testCases.findIndex(tc => tc.id === editingTestCaseId);
    if (index !== -1) {
        testCase.usageCount = testCases[index].usageCount || 0;
        testCases[index] = testCase;
    }
} else {
    testCases.push(testCase);
}

await saveAllData();
clearTestCaseForm();
cancelTestCaseEdit();
renderTestCasesTable();
showNotification(`Caso ${editingTestCaseId ? 'actualizado' : 'guardado'}`, 'success');
}

function updateTestCase() { saveTestCase(); }

function editTestCase(id) {
const tc = testCases.find(t => t.id === id);
if (!tc) return;
editingTestCaseId = tc.id;
document.getElementById('testCaseEditingIndicator').style.display = 'flex';
document.getElementById('editingTestCaseId').textContent = tc.id;
document.getElementById('submitTestCaseBtn').innerHTML = '<i class="fas fa-save"></i> Actualizar Caso';
document.getElementById('submitTestCaseBtn').classList.remove('btn-success');
document.getElementById('submitTestCaseBtn').classList.add('btn-warning');
document.getElementById('cancelTestCaseEdit').style.display = 'block';
document.getElementById('testCaseId').value = tc.id;
document.getElementById('testCaseId').readOnly = true;
document.getElementById('testCaseTitle').value = tc.title || '';
document.getElementById('testCasePreconditions').value = tc.preconditions || '';
document.getElementById('testCaseExpected').value = tc.expectedResults || '';
document.getElementById('testCaseActual').value = tc.actualResult || '';
document.getElementById('testCaseStatus').value = tc.status || 'Not Executed';

// Cargar pasos (ya deben ser objetos, pero por si acaso)
currentTestCaseSteps = (tc.steps || []).map(s => {
    if (typeof s === 'string') return { description: s };
    return { description: s.description || '', expected: s.expected, data: s.data };
});
renderStepsList();

testCaseImage = tc.image || null;
updateTestCaseImagePreview();
document.querySelector('[data-tab="create-test-case"]').click();
}
window.editTestCase = editTestCase;

function cancelTestCaseEdit() {
editingTestCaseId = null;
document.getElementById('testCaseEditingIndicator').style.display = 'none';
document.getElementById('submitTestCaseBtn').innerHTML = '<i class="fas fa-save"></i> Guardar Caso de Prueba';
document.getElementById('submitTestCaseBtn').classList.remove('btn-warning');
document.getElementById('submitTestCaseBtn').classList.add('btn-success');
document.getElementById('cancelTestCaseEdit').style.display = 'none';
document.getElementById('testCaseId').readOnly = false;
clearTestCaseForm();
}

function clearTestCaseForm() {
document.getElementById('testCaseForm').reset();
document.getElementById('testCaseStatus').value = 'Not Executed';
currentTestCaseSteps = [];
renderStepsList();
testCaseImage = null;
updateTestCaseImagePreview();
}

async function deleteTestCase(id) {
if (confirm('¿Eliminar caso de prueba?')) {
    testCases = testCases.filter(tc => tc.id !== id);
    await saveAllData();
    renderTestCasesTable();
    showNotification('Caso eliminado', 'success');
}
}
window.deleteTestCase = deleteTestCase;

function useTestCaseInReport(id) {
const tc = testCases.find(t => t.id === id);
if (tc) {
    // Convertir los pasos a texto para el reporte, incluyendo detalles si existen
    let stepsText = '';
    if (tc.steps && tc.steps.length) {
        stepsText = tc.steps.map((s, i) => {
            let line = `${i+1}. ${s.description}`;
            if (s.expected) line += `\n   Esperado: ${s.expected}`;
            if (s.data) line += `\n   Datos: ${s.data}`;
            return line;
        }).join('\n\n');
    }
    document.getElementById('bugSteps').value = stepsText;
    document.getElementById('bugExpected').value = tc.expectedResults || '';
    document.querySelector('[data-tab="bug-report"]').click();
    document.querySelector('[data-tab="tab-details"]').click();
    tc.usageCount = (tc.usageCount || 0) + 1;
    saveAllData();
    showNotification('Caso cargado en reporte', 'success');
}
}
window.useTestCaseInReport = useTestCaseInReport;

// Actualizar la tabla de casos para mostrar resumen de pasos y con arrastre
function renderTestCasesTable() {
const container = document.getElementById('testCasesTableContainer');
const emptyState = document.getElementById('emptyTestCasesState');
if (!container) return;
if (testCases.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    // Destruir sortable si existe
    if (testCasesSortable) {
        testCasesSortable.destroy();
        testCasesSortable = null;
    }
    return;
}
emptyState.style.display = 'none';

let html = `<table class="test-cases-table">
    <thead>
        <tr>
            <th class="drag-handle-cell"></th>
            <th>ID</th>
            <th>Título</th>
            <th>Precondiciones</th>
            <th>Pasos</th>
            <th>Resultado Esperado</th>
            <th>Resultado Obtenido</th>
            <th>Adjunto</th>
            <th>Estado</th>
            <th>Acciones</th>
        </tr>
    </thead>
    <tbody id="testCasesTableBody">`;

testCases.forEach(tc => {
    // Resumen de pasos: mostrar cantidad y tooltip con detalles
    const stepsCount = tc.steps ? tc.steps.length : 0;
    let stepsSummary = `${stepsCount} paso(s)`;
    if (stepsCount > 0) {
        const stepTitles = tc.steps.map((s, i) => `${i+1}. ${s.description.substring(0,30)}${s.description.length > 30 ? '...' : ''}`).join('\n');
        stepsSummary = `<span title="${stepTitles.replace(/"/g, '&quot;')}">${stepsCount} paso(s) 📋</span>`;
    }
    
    const expectedShort = tc.expectedResults ? tc.expectedResults.substring(0,60) + (tc.expectedResults.length > 60 ? '...' : '') : '';
    const actualShort = tc.actualResult ? tc.actualResult.substring(0,60) + (tc.actualResult.length > 60 ? '...' : '') : '';
    const statusClass = 'status-' + (tc.status ? tc.status.toLowerCase().replace(' ', '-') : 'not-executed');
    const statusText = tc.status || 'Not Executed';
    let thumbnail = '';
    if (tc.image && tc.image.data) {
        thumbnail = `<img src="${tc.image.data}" class="test-case-thumbnail" onclick="showImageInModal('${tc.image.data}')" title="${tc.image.name}">`;
    } else {
        thumbnail = '<span style="color:#95a5a6;">Sin imagen</span>';
    }
    html += `<tr data-id="${tc.id}">
        <td class="drag-handle-cell"><i class="fas fa-grip-vertical"></i></td>
        <td><strong>${tc.id}</strong></td>
        <td>${tc.title || ''}</td>
        <td>${tc.preconditions || ''}</td>
        <td>${stepsSummary}</td>
        <td>${expectedShort || ''}</td>
        <td>${actualShort || ''}</td>
        <td style="text-align:center;">${thumbnail}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>
            <button class="btn-warning btn-sm" onclick="editTestCase('${tc.id}')" title="Editar"><i class="fas fa-edit"></i></button>
            <button class="btn-danger btn-sm" onclick="deleteTestCase('${tc.id}')" title="Eliminar"><i class="fas fa-trash"></i></button>
            <button class="btn-primary btn-sm" onclick="useTestCaseInReport('${tc.id}')" title="Usar en reporte"><i class="fas fa-bug"></i></button>
        </td>
    </tr>`;
});
html += `</tbody></table>`;
container.innerHTML = html;

// Inicializar Sortable en el tbody
const tbody = document.getElementById('testCasesTableBody');
if (testCasesSortable) testCasesSortable.destroy();
testCasesSortable = new Sortable(tbody, {
    animation: 150,
    handle: '.drag-handle-cell',
    onEnd: function(evt) {
        // Reordenar el array testCases según el nuevo orden de las filas
        const rows = tbody.querySelectorAll('tr');
        const newOrder = [];
        rows.forEach(row => {
            const id = row.dataset.id;
            const tc = testCases.find(t => t.id === id);
            if (tc) newOrder.push(tc);
        });
        // Reemplazar testCases con el nuevo orden
        testCases = newOrder;
        // Guardar el nuevo orden en la base de datos (opcional, pero recomendado)
        saveAllData();
        // Re-renderizar para actualizar cualquier cosa (aunque no es necesario porque el DOM ya está actualizado)
        // Pero para mantener consistencia, podemos llamar a renderTestCasesTable() de nuevo, pero eso perdería el orden.
        // Mejor no llamar a render, ya que el DOM ya refleja el nuevo orden.
        // Sin embargo, necesitamos actualizar los atributos data-id? Ya están correctos.
        // Opcional: actualizar los números de paso en la tabla (no aplica)
    }
});
}

function filterTestCasesTable() {
const term = document.getElementById('searchTestCases').value.toLowerCase();
const rows = document.querySelectorAll('#testCasesTableBody tr');
rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(term) ? '' : 'none';
});
}

// ==================== EXPORTAR CASOS DE PRUEBA A PDF ====================
function generateTestCasesPDF() {
if (testCases.length === 0) { showNotification('No hay casos de prueba para exportar', 'warning'); return; }
const searchTerm = document.getElementById('searchTestCases').value.toLowerCase();
let filteredCases = testCases;
if (searchTerm) {
    filteredCases = testCases.filter(tc => 
        (tc.id && tc.id.toLowerCase().includes(searchTerm)) ||
        (tc.title && tc.title.toLowerCase().includes(searchTerm)) ||
        (tc.preconditions && tc.preconditions.toLowerCase().includes(searchTerm)) ||
        (tc.steps && tc.steps.some(s => s.description.toLowerCase().includes(searchTerm))) ||
        (tc.expectedResults && tc.expectedResults.toLowerCase().includes(searchTerm)) ||
        (tc.actualResult && tc.actualResult.toLowerCase().includes(searchTerm))
    );
}
if (filteredCases.length === 0) { showNotification('No hay casos visibles con el filtro actual', 'warning'); return; }

const { jsPDF } = window.jspdf;
const pdf = new jsPDF('l', 'mm', 'a4');
const pageWidth = pdf.internal.pageSize.width;
const pageHeight = pdf.internal.pageSize.height;

pdf.setFontSize(16);
pdf.setTextColor(44, 62, 80);
pdf.text(`Casos de Prueba - ${currentProject ? currentProject.name : 'Proyecto'}`, 14, 20);
pdf.setFontSize(11);
pdf.setTextColor(100, 100, 100);
pdf.text(`Generado: ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}`, 14, 28);
pdf.text(`Total de casos: ${filteredCases.length}`, 14, 34);

const columns = [
    { header: 'ID', dataKey: 'id' },
    { header: 'Título', dataKey: 'title' },
    { header: 'Precondiciones', dataKey: 'preconditions' },
    { header: 'Pasos', dataKey: 'steps' },
    { header: 'Resultado Esperado', dataKey: 'expected' },
    { header: 'Resultado Obtenido', dataKey: 'actual' },
    { header: 'Estado', dataKey: 'status' }
];

const rows = filteredCases.map(tc => {
    // Formatear pasos para PDF: incluir detalles si existen
    let stepsText = '';
    if (tc.steps && tc.steps.length) {
        stepsText = tc.steps.map((s, i) => {
            let line = `${i+1}. ${s.description}`;
            if (s.expected) line += `\n   Esp: ${s.expected}`;
            if (s.data) line += `\n   Dat: ${s.data}`;
            return line;
        }).join('\n');
    }
    return {
        id: tc.id,
        title: tc.title || '',
        preconditions: tc.preconditions || '',
        steps: stepsText,
        expected: tc.expectedResults || '',
        actual: tc.actualResult || '',
        status: tc.status || 'Not Executed'
    };
});

pdf.autoTable({
    startY: 40,
    head: [columns.map(col => col.header)],
    body: rows.map(row => columns.map(col => row[col.dataKey])),
    theme: 'striped',
    headStyles: { fillColor: [52, 152, 219], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
        id: { cellWidth: 20 },
        title: { cellWidth: 50 },
        preconditions: { cellWidth: 45 },
        steps: { cellWidth: 80 },
        expected: { cellWidth: 45 },
        actual: { cellWidth: 45 },
        status: { cellWidth: 25 }
    },
    margin: { left: 10, right: 10 },
    didDrawPage: function(data) {
        pdf.setFontSize(10);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Página ${data.pageNumber}`, pageWidth - 30, pageHeight - 10);
    }
});

const casesWithImage = filteredCases.filter(tc => tc.image && tc.image.data);
if (casesWithImage.length > 0) {
    casesWithImage.forEach((tc, index) => {
        pdf.addPage();
        pdf.setFontSize(14);
        pdf.setTextColor(44, 62, 80);
        pdf.text(`Anexo - Caso: ${tc.id}`, 14, 20);
        pdf.setFontSize(11);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Título: ${tc.title}`, 14, 30);
        pdf.text(`Archivo: ${tc.image.name}`, 14, 38);
        
        const maxWidth = pageWidth - 40;
        const maxHeight = pageHeight - 70;
        let imgWidth = maxWidth;
        let imgHeight = maxHeight;
        const ratio = 4/3;
        if (imgWidth / imgHeight > ratio) { imgWidth = imgHeight * ratio; } else { imgHeight = imgWidth / ratio; }
        const xPos = (pageWidth - imgWidth) / 2;
        const yPos = 50 + (maxHeight - imgHeight) / 2;
        
        try {
            let imgFormat = 'JPEG';
            if (tc.image.data.startsWith('data:image/png')) imgFormat = 'PNG';
            pdf.addImage(tc.image.data, imgFormat, xPos, yPos, imgWidth, imgHeight);
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Imagen del caso ${tc.id}`, pageWidth / 2, yPos + imgHeight + 15, { align: 'center' });
        } catch (error) {
            pdf.setFontSize(10);
            pdf.setTextColor(231, 76, 60);
            pdf.text('Error al cargar la imagen', pageWidth / 2, yPos + 20, { align: 'center' });
        }
        
        pdf.setFontSize(10);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Página ${pdf.internal.getNumberOfPages()}`, pageWidth - 30, pageHeight - 10);
    });
}

const fileName = `Casos_Prueba_${new Date().toISOString().split('T')[0]}.pdf`;
pdf.save(fileName);
showNotification(`PDF generado con ${filteredCases.length} casos (${casesWithImage.length} con imagen)`, 'success');
}

// ==================== PASOS PREDEFINIDOS Y CATEGORÍAS ====================
function setupPredefinedSteps() {
const savePredefinedStepBtn = document.getElementById('savePredefinedStep');
const searchSteps = document.getElementById('searchSteps');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const createCategoryBtn = document.getElementById('createCategoryBtn');
const newCategoryInput = document.getElementById('createCategoryInput');
updateCategoriesSelect('newStepCategory');
if (savePredefinedStepBtn) savePredefinedStepBtn.addEventListener('click', savePredefinedStep);
if (searchSteps) searchSteps.addEventListener('input', filterPredefinedSteps);
if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', function() {
        const catSelect = document.getElementById('newStepCategory');
        const catInput = document.getElementById('newCategoryInput');
        if (catSelect.style.display !== 'none') {
            catSelect.style.display = 'none'; catInput.style.display = 'block'; catInput.value = ''; addCategoryBtn.innerHTML = '<i class="fas fa-check"></i> Usar';
        } else {
            const newCat = catInput.value.trim();
            if (newCat) { addCategory(newCat); catSelect.value = newCat; catSelect.style.display = 'block'; catInput.style.display = 'none'; catInput.value = ''; addCategoryBtn.innerHTML = '<i class="fas fa-plus"></i> Nueva'; showNotification(`Categoría "${newCat}" creada`,'success'); }
            else showNotification('Ingrese nombre','warning');
        }
    });
}
if (createCategoryBtn) {
    createCategoryBtn.addEventListener('click', function() {
        const cat = newCategoryInput.value.trim();
        if (cat) { addCategory(cat); newCategoryInput.value = ''; showNotification(`Categoría "${cat}" agregada`,'success'); }
        else showNotification('Ingrese nombre','warning');
    });
}
newCategoryInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); const cat = this.value.trim(); if (cat) { addCategory(cat); this.value = ''; showNotification(`Categoría "${cat}" agregada`,'success'); } }
});
}
function updateCategoriesSelect(selectId) {
const select = document.getElementById(selectId);
if (!select) return;
const current = select.value;
while (select.options.length > 1) select.remove(1);
[...categories].sort().forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat; opt.textContent = cat; select.appendChild(opt);
});
if (current && categories.includes(current)) select.value = current;
}
function addCategory(category) {
if (!category) return;
if (!categories.includes(category)) {
    categories.push(category);
    saveCategories();
    updateCategoriesList();
    updateCategoriesSelect('newStepCategory');
    updateCategoriesSelect('customStepCategory');
}
}
function removeCategory(category) {
if (confirm(`¿Eliminar categoría "${category}"?`)) {
    categories = categories.filter(c => c !== category);
    predefinedSteps.forEach(step => { if (step.category === category) step.category = "Other"; });
    saveCategories(); saveAllData();
    updateCategoriesList(); updateCategoriesSelect('newStepCategory'); updateCategoriesSelect('customStepCategory'); updatePredefinedStepsList();
    showNotification(`Categoría "${category}" eliminada`,'success');
}
}
function updateCategoriesList() {
const container = document.getElementById('categoriesListContainer');
if (!container) return;
container.innerHTML = '';
if (categories.length === 0) { container.innerHTML = '<p style="color:#7f8c8d; text-align:center; padding:10px;">No hay categorías</p>'; return; }
const list = document.createElement('div'); list.className = 'categories-list';
[...categories].sort().forEach(cat => {
    const tag = document.createElement('div'); tag.className = 'category-tag';
    tag.innerHTML = `${cat} <button class="remove-category" data-category="${cat}"><i class="fas fa-times"></i></button>`;
    list.appendChild(tag);
});
container.appendChild(list);
container.querySelectorAll('.remove-category').forEach(btn => {
    btn.addEventListener('click', function() { removeCategory(this.dataset.category); });
});
}
function saveCategories() {
if (!currentProject) return;
db.categories.put({ id: 'categories', projectId: currentProject.id, list: categories });
}
async function savePredefinedStep() {
const desc = document.getElementById('newStepDescription').value.trim();
const catSelect = document.getElementById('newStepCategory');
const cat = catSelect.value;
if (!desc) { showNotification('Ingrese descripción','warning'); return; }
if (!cat) { showNotification('Seleccione categoría','warning'); return; }
if (predefinedSteps.some(s => s.description.toLowerCase() === desc.toLowerCase())) { showNotification('Ya existe','warning'); return; }
const newStep = {
    id: predefinedSteps.length > 0 ? Math.max(...predefinedSteps.map(s => s.id)) + 1 : 1,
    description: desc, category: cat, usageCount: 0, createdAt: new Date().toISOString(), projectId: currentProject.id
};
predefinedSteps.push(newStep); 
await saveAllData();
document.getElementById('newStepDescription').value = ''; catSelect.value = '';
updatePredefinedStepsList(); 
showNotification('Paso guardado','success');
}
function updatePredefinedStepsList() {
const container = document.getElementById('predefinedStepsList');
if (!container) return;
container.innerHTML = '';
if (predefinedSteps.length === 0) { container.innerHTML = '<div style="color:#7f8c8d; padding:20px; text-align:center;">No hay pasos predefinidos</div>'; return; }
const sorted = [...predefinedSteps].sort((a,b) => a.category.localeCompare(b.category) || a.description.localeCompare(b.description));
const byCat = {};
sorted.forEach(step => { if (!byCat[step.category]) byCat[step.category] = []; byCat[step.category].push(step); });
Object.keys(byCat).sort().forEach(cat => {
    const header = document.createElement('div');
    header.style.cssText = 'background:#e0f2fe; color:#3498db; padding:8px 12px; font-weight:600; border-radius:4px; margin:10px 0 5px 0; display:flex; justify-content:space-between;';
    header.innerHTML = `<span>${cat}</span><span style="font-size:0.8rem;">${byCat[cat].length} pasos</span>`;
    container.appendChild(header);
    byCat[cat].forEach(step => {
        const el = document.createElement('div'); el.className = 'predefined-step';
        el.innerHTML = `<div style="display:flex; justify-content:space-between;"><span>${step.description}</span><div><span style="font-size:0.8rem; color:#7f8c8d; margin-right:10px;"><i class="fas fa-recycle"></i> ${step.usageCount || 0}</span><button class="delete-btn" data-id="${step.id}" style="background:none; border:none; color:#e74c3c;"><i class="fas fa-trash"></i></button></div></div>`;
        container.appendChild(el);
    });
});
container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
        const id = parseInt(this.dataset.id);
        if (confirm('¿Eliminar paso?')) { 
            predefinedSteps = predefinedSteps.filter(s => s.id !== id); 
            await saveAllData(); 
            updatePredefinedStepsList(); 
        }
    });
});
}
function filterPredefinedSteps() {
const term = document.getElementById('searchSteps').value.toLowerCase();
document.querySelectorAll('#predefinedStepsList .predefined-step').forEach(el => {
    el.style.display = el.textContent.toLowerCase().includes(term) ? 'block' : 'none';
});
}

// ==================== MODALES ====================
function setupModals() {
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', function() { this.closest('.modal').style.display = 'none'; });
});
window.addEventListener('click', e => { if (e.target.classList.contains('modal')) e.target.style.display = 'none'; });
const modalTabs = document.querySelectorAll('.modal-tab');
modalTabs.forEach(tab => {
    tab.addEventListener('click', function() {
        modalTabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(this.dataset.tab).classList.add('active');
    });
});
document.getElementById('selectTestCaseBtn').addEventListener('click', useSelectedTestCase);
document.getElementById('closeModalBtn').addEventListener('click', () => document.getElementById('testCaseModal').style.display = 'none');

// El modal de paso personalizado ahora se configura aparte
setupCustomStepModal();

document.getElementById('modalSearchTestCases').addEventListener('input', filterModalTestCases);
document.getElementById('modalSearchSteps').addEventListener('input', filterModalSteps);

// Setup del modal de grabar test
setupRecordTestModal();
}

// ==================== GRABAR TEST CASE ====================
function setupRecordTestModal() {
document.getElementById('recordTestBtn').addEventListener('click', openRecordModal);
document.getElementById('generateCommandBtn').addEventListener('click', generateRecordCommand);
document.getElementById('recordProject').addEventListener('change', updateRecordOutputPath);
document.getElementById('recordTestName').addEventListener('input', updateRecordOutputPath);
document.getElementById('closeRecordModalBtn').addEventListener('click', closeRecordModal);
document.getElementById('cancelRecordModalBtn').addEventListener('click', closeRecordModal);
}

function openRecordModal() {
// Cargar proyectos en el select
const select = document.getElementById('recordProject');
select.innerHTML = '<option value="">Seleccionar proyecto...</option>' +
    projects.map(p => `<option value="${p.name}">${p.name}</option>`).join('');

document.getElementById('recordTestName').value = '';
document.getElementById('recordUrl').value = '';
document.getElementById('recordOutputPath').value = '';
document.getElementById('recordCommandBox').style.display = 'none';

document.getElementById('recordTestModal').style.display = 'flex';
}
window.openRecordModal = openRecordModal;

function closeRecordModal() {
document.getElementById('recordTestModal').style.display = 'none';
}
window.closeRecordModal = closeRecordModal;

function updateRecordOutputPath() {
const project = document.getElementById('recordProject').value;
const testName = document.getElementById('recordTestName').value.trim();

if (project && testName) {
    const safeName = testName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    document.getElementById('recordOutputPath').value = `tests/${project}/${safeName}.spec.js`;
} else {
    document.getElementById('recordOutputPath').value = '';
}
}

function generateRecordCommand() {
const project = document.getElementById('recordProject').value;
const testName = document.getElementById('recordTestName').value.trim();
const url = document.getElementById('recordUrl').value.trim();

if (!project) { showNotification('Selecciona un proyecto', 'warning'); return; }
if (!testName) { showNotification('Ingresa el nombre del test', 'warning'); return; }
if (!url) { showNotification('Ingresa la URL', 'warning'); return; }

const safeName = testName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
const safeProject = project.replace(/[^a-zA-Z0-9-_]/g, '-');
const outputPath = `tests/${safeProject}/${safeName}.spec.js`;
const outputDir = `tests/${safeProject}`;

// Asegurar que el directorio exista (manejando espacios en blanco)
const dirCmd = isWindows
    ? `if not exist "${outputDir}" mkdir "${outputDir}"`
    : `mkdir -p "${outputDir}"`;

const command = `${dirCmd} && npx playwright codegen -o "${outputPath}" ${url}`;

document.getElementById('recordCommandText').textContent = command;
document.getElementById('recordCommandBox').style.display = 'block';
showNotification('Comando generado. Cópialo y ejecútalo en terminal.', 'success');
}

function copyRecordCommand() {
const command = document.getElementById('recordCommandText').textContent;
navigator.clipboard.writeText(command).then(() => {
    showNotification('¡Comando copiado al portapapeles!', 'success');
}).catch(() => {
    // Fallback para navegadores antiguos
    const textarea = document.createElement('textarea');
    textarea.value = command;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showNotification('¡Comando copiado!', 'success');
});
}
window.copyRecordCommand = copyRecordCommand;

function openTestCaseModal() {
renderModalTestCases();
renderModalPredefinedSteps();
document.getElementById('testCaseModal').style.display = 'flex';
}
function renderModalTestCases() {
const container = document.getElementById('modalTestCasesList');
container.innerHTML = '';
if (testCases.length === 0) { container.innerHTML = '<div style="color:#7f8c8d; padding:20px;">No hay casos</div>'; return; }
testCases.forEach(tc => {
    const el = document.createElement('div'); el.className = 'predefined-step';
    el.innerHTML = `<div style="display:flex; align-items:center;"><input type="radio" name="selectedTestCase" value="${tc.id}" id="case_${tc.id}" style="margin-right:10px;"><label for="case_${tc.id}" style="cursor:pointer;"><strong>${tc.id}</strong>: ${tc.title}</label></div>`;
    container.appendChild(el);
});
}
function renderModalPredefinedSteps() {
const container = document.getElementById('modalPredefinedStepsList');
container.innerHTML = '';
if (predefinedSteps.length === 0) { container.innerHTML = '<div style="color:#7f8c8d; padding:20px;">No hay pasos</div>'; return; }
selectedPredefinedSteps = [];
predefinedSteps.forEach(step => {
    const el = document.createElement('div'); el.className = 'predefined-step';
    el.innerHTML = `<div style="display:flex; align-items:center;"><input type="checkbox" class="step-checkbox" data-id="${step.id}" id="step_${step.id}" style="margin-right:10px;"><span class="step-category">${step.category}</span><span>${step.description}</span></div>`;
    container.appendChild(el);
});
container.querySelectorAll('.step-checkbox').forEach(cb => {
    cb.addEventListener('change', function() {
        const id = parseInt(this.dataset.id);
        if (this.checked) selectedPredefinedSteps.push(id);
        else selectedPredefinedSteps = selectedPredefinedSteps.filter(i => i !== id);
    });
});
}
function useSelectedTestCase() {
const active = document.querySelector('.modal-tab.active').dataset.tab;
if (active === 'tab-test-cases') {
    const sel = document.querySelector('input[name="selectedTestCase"]:checked');
    if (!sel) { showNotification('Seleccione un caso', 'warning'); return; }
    const tc = testCases.find(t => t.id === sel.value);
    if (tc) {
        useTestCaseInReport(tc.id);
    }
} else {
    if (selectedPredefinedSteps.length === 0) { showNotification('Seleccione al menos un paso', 'warning'); return; }
    const steps = predefinedSteps.filter(s => selectedPredefinedSteps.includes(s.id));
    steps.forEach(s => {
        currentTestCaseSteps.push({ description: s.description });
    });
    renderStepsList();
    steps.forEach(s => { s.usageCount = (s.usageCount || 0) + 1; }); 
    saveAllData();
    showNotification(`${steps.length} paso(s) agregado(s) al caso`, 'success');
}
document.getElementById('testCaseModal').style.display = 'none';
selectedPredefinedSteps = [];
}
function filterModalTestCases() {
const term = document.getElementById('modalSearchTestCases').value.toLowerCase();
document.querySelectorAll('#modalTestCasesList .predefined-step').forEach(el => {
    el.style.display = el.textContent.toLowerCase().includes(term) ? 'block' : 'none';
});
}
function filterModalSteps() {
const term = document.getElementById('modalSearchSteps').value.toLowerCase();
document.querySelectorAll('#modalPredefinedStepsList .predefined-step').forEach(el => {
    el.style.display = el.textContent.toLowerCase().includes(term) ? 'block' : 'none';
});
}

// ==================== GESTIÓN DE PROYECTOS ====================
function setupProjectsManagement() {
document.getElementById('createProjectBtn').addEventListener('click', createProject);
document.getElementById('clearProjectFormBtn').addEventListener('click', function() {
    document.getElementById('projectName').value = ''; document.getElementById('projectDescription').value = '';
    const btn = document.getElementById('createProjectBtn');
    btn.innerHTML = '<i class="fas fa-plus-circle"></i> Crear Proyecto'; btn.onclick = createProject;
});
document.getElementById('currentProject').addEventListener('change', function() { switchProject(this.value); });
document.getElementById('manageProjectsBtn').addEventListener('click', () => document.querySelector('[data-tab="projects-management"]').click());
document.getElementById('exportProjectBtn').addEventListener('click', () => { if (currentProject) exportProject(currentProject.id); else showNotification('No hay proyecto activo','warning'); });
document.getElementById('exportAllData').addEventListener('click', exportAllData);
document.getElementById('importData').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = e => importData(e.target.files[0]);
    input.click();
});
document.getElementById('clearOldData').addEventListener('click', clearOldData);
}

async function switchProject(projectId) {
projects.forEach(p => p.isActive = false);
const newProject = projects.find(p => p.id === projectId);
if (newProject) {
    newProject.isActive = true;
    saveProjects();
    currentProject = newProject;
    await loadAllData();
    updateBugList();
    renderTestCasesTable();
    updatePredefinedStepsList();
    updateCategoriesList();
    populateAllEnvironmentSelects();
    updateProjectSelector();
    updateCharts();
    showNotification(`Proyecto cambiado a: ${newProject.name}`, 'success');
}
}
window.switchProject = switchProject;

function createProject() {
const name = document.getElementById('projectName').value.trim();
if (!name) { showNotification('Ingrese nombre','warning'); return; }
if (projects.some(p => p.name.toLowerCase() === name.toLowerCase())) { showNotification('Ya existe ese nombre','warning'); return; }
projects.push({
    id: generateId(), name: name,
    description: document.getElementById('projectDescription').value.trim(),
    color: document.getElementById('projectColor').value,
    createdAt: new Date().toISOString(), isActive: false
});
saveProjects();
document.getElementById('projectName').value = ''; document.getElementById('projectDescription').value = '';
updateProjectsList(); updateProjectSelector();
showNotification(`Proyecto "${name}" creado`,'success');
}
function editProject(id) {
const p = projects.find(p => p.id === id);
if (!p) return;
document.getElementById('projectName').value = p.name;
document.getElementById('projectDescription').value = p.description || '';
document.getElementById('projectColor').value = p.color;
const btn = document.getElementById('createProjectBtn');
btn.innerHTML = '<i class="fas fa-save"></i> Actualizar Proyecto';
btn.onclick = function() { updateProject(id); };
}
window.editProject = editProject;
function updateProject(id) {
const name = document.getElementById('projectName').value.trim();
if (!name) { showNotification('Ingrese nombre','warning'); return; }
const idx = projects.findIndex(p => p.id === id);
if (idx === -1) return;
projects[idx].name = name;
projects[idx].description = document.getElementById('projectDescription').value.trim();
projects[idx].color = document.getElementById('projectColor').value;
saveProjects();
document.getElementById('projectName').value = ''; document.getElementById('projectDescription').value = '';
const btn = document.getElementById('createProjectBtn');
btn.innerHTML = '<i class="fas fa-plus-circle"></i> Crear Proyecto'; btn.onclick = createProject;
updateProjectsList(); updateProjectSelector();
if (currentProject && currentProject.id === id) currentProject = projects[idx];
showNotification('Proyecto actualizado','success');
}

async function deleteProject(id) {
const p = projects.find(p => p.id === id);
if (!p) return;
if (p.isActive) { showNotification('No se puede eliminar el proyecto activo', 'warning'); return; }
if (projects.length === 1) { showNotification('No se puede eliminar el único proyecto', 'warning'); return; }

if (confirm(`¿Eliminar proyecto "${p.name}" y todos sus datos?`)) {
    await db.bugs.where('projectId').equals(id).delete();
    await db.testCases.where('projectId').equals(id).delete();
    await db.predefinedSteps.where('projectId').equals(id).delete();
    await db.categories.where('projectId').equals(id).delete();
    await db.fieldValues.where('projectId').equals(id).delete();
    
    projects = projects.filter(p => p.id !== id);
    saveProjects();
    updateProjectsList();
    updateProjectSelector();
    showNotification('Proyecto eliminado', 'success');
}
}
window.deleteProject = deleteProject;

function updateProjectsList() {
const container = document.getElementById('projectsList');
const empty = document.getElementById('emptyProjectsState');
if (!container) return;
if (projects.length === 0) { container.innerHTML = ''; empty.style.display = 'block'; return; }
empty.style.display = 'none'; container.innerHTML = '';
projects.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(p => {
    const bugsCount = bugs.filter(b => b.projectId === p.id).length;
    const tcCount = testCases.filter(tc => tc.projectId === p.id).length;
    const card = document.createElement('div'); card.className = `project-card ${p.isActive ? 'active' : ''}`; card.style.borderLeftColor = p.color;
    card.innerHTML = `
        <div class="project-name">${p.name} ${p.isActive ? '<span class="project-active-badge">Activo</span>' : ''}</div>
        <div class="project-description">${p.description || 'Sin descripción'}</div>
        <div class="project-stats">
            <div><i class="fas fa-bug"></i> ${bugsCount} reportes</div>
            <div><i class="fas fa-vial"></i> ${tcCount} casos</div>
            <div><i class="fas fa-calendar"></i> ${new Date(p.createdAt).toLocaleDateString('es-ES')}</div>
        </div>
        <div class="project-actions">
            ${!p.isActive ? `<button class="btn-primary btn-sm" onclick="switchProject('${p.id}')"><i class="fas fa-check"></i> Activar</button>` : ''}
            <button class="btn-warning btn-sm" onclick="editProject('${p.id}')"><i class="fas fa-edit"></i> Editar</button>
            <button class="btn-success btn-sm" onclick="exportProject('${p.id}')"><i class="fas fa-download"></i> Exportar</button>
            ${!p.isActive && projects.length > 1 ? `<button class="btn-danger btn-sm" onclick="deleteProject('${p.id}')"><i class="fas fa-trash"></i> Eliminar</button>` : ''}
        </div>
    `;
    container.appendChild(card);
});
}

function updateProjectSelector() {
const sel = document.getElementById('currentProject');
sel.innerHTML = '';
projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = p.name; opt.selected = p.isActive; sel.appendChild(opt);
});
}

// ==================== FUNCIONES DE EXPORTACIÓN/IMPORTACIÓN ====================
async function exportProject(id) {
const p = projects.find(p => p.id === id);
if (!p) return;

const bugsData = await db.bugs.where('projectId').equals(id).toArray();
const testCasesData = await db.testCases.where('projectId').equals(id).toArray();
const stepsData = await db.predefinedSteps.where('projectId').equals(id).toArray();
const catRecord = await db.categories.get({ id: 'categories', projectId: id });
const cats = catRecord ? catRecord.list : [];
const fv = await db.fieldValues.get(id) || { version:[], os:[], browser:[], resolution:[], device:[], build:[] };

const data = {
    project: p,
    bugs: bugsData,
    testCases: testCasesData,
    predefinedSteps: stepsData,
    categories: cats,
    fieldValues: fv,
    exportDate: new Date().toISOString()
};
const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = `proyecto_${p.name.replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.json`;
a.click(); URL.revokeObjectURL(url);
showNotification('Proyecto exportado','success');
}

async function exportAllData() {
const all = { projects: projects.map(p => ({ ...p })), exportDate: new Date().toISOString() };
for (const p of projects) {
    const bugsData = await db.bugs.where('projectId').equals(p.id).toArray();
    const testCasesData = await db.testCases.where('projectId').equals(p.id).toArray();
    const stepsData = await db.predefinedSteps.where('projectId').equals(p.id).toArray();
    const catRecord = await db.categories.get({ id: 'categories', projectId: p.id });
    const cats = catRecord ? catRecord.list : [];
    const fv = await db.fieldValues.get(p.id) || { version:[], os:[], browser:[], resolution:[], device:[], build:[] };
    all[`project_${p.id}`] = {
        bugs: bugsData,
        testCases: testCasesData,
        predefinedSteps: stepsData,
        categories: cats,
        fieldValues: fv
    };
}
const blob = new Blob([JSON.stringify(all,null,2)], {type:'application/json'});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = `backup_qa_${new Date().toISOString().split('T')[0]}.json`;
a.click(); URL.revokeObjectURL(url);
showNotification('Datos exportados','success');
}

async function importData(file) {
if (!file) return;
const reader = new FileReader();
reader.onload = async e => {
    try {
        const data = JSON.parse(e.target.result);
        
        if (data.projects && Array.isArray(data.projects)) {
            if (!confirm('¿Importar backup completo? Esto reemplazará todos los proyectos existentes y sus datos.')) return;
            
            const oldActiveId = currentProject ? currentProject.id : null;
            
            for (const p of projects) {
                await db.bugs.where('projectId').equals(p.id).delete();
                await db.testCases.where('projectId').equals(p.id).delete();
                await db.predefinedSteps.where('projectId').equals(p.id).delete();
                await db.categories.where('projectId').equals(p.id).delete();
                await db.fieldValues.where('projectId').equals(p.id).delete();
            }
            
            projects = data.projects;
            saveProjects();
            
            for (const p of projects) {
                const key = `project_${p.id}`;
                if (data[key]) {
                    try {
                        if (data[key].bugs) await db.bugs.bulkPut(data[key].bugs.map(b => ({ ...b, projectId: p.id })));
                        if (data[key].testCases) await db.testCases.bulkPut(data[key].testCases.map(tc => ({ ...tc, projectId: p.id })));
                        if (data[key].predefinedSteps) await db.predefinedSteps.bulkPut(data[key].predefinedSteps.map(s => ({ ...s, projectId: p.id })));
                        if (data[key].categories) await db.categories.put({ id: 'categories', projectId: p.id, list: data[key].categories });
                        if (data[key].fieldValues) await db.fieldValues.put({ projectId: p.id, ...data[key].fieldValues });
                    } catch (err) {
                        console.error(`Error importando proyecto ${p.id}:`, err);
                        showNotification(`Error en proyecto ${p.name}: ${err.message}`, 'error');
                    }
                }
            }
            
            let newActive = projects.find(p => p.id === oldActiveId);
            if (!newActive && projects.length > 0) newActive = projects[0];
            if (newActive) {
                projects.forEach(p => p.isActive = (p.id === newActive.id));
                saveProjects();
                currentProject = newActive;
            }
            
        } else if (data.project && data.project.id) {
            if (!confirm('¿Importar proyecto? Se añadirá a la lista actual. Si ya existe un proyecto con el mismo ID, se reemplazarán sus datos.')) return;
            
            const newProject = data.project;
            const existingIndex = projects.findIndex(p => p.id === newProject.id);
            if (existingIndex !== -1) {
                projects[existingIndex] = newProject;
            } else {
                projects.push(newProject);
            }
            saveProjects();
            
            const p = newProject;
            await db.bugs.where('projectId').equals(p.id).delete();
            await db.testCases.where('projectId').equals(p.id).delete();
            await db.predefinedSteps.where('projectId').equals(p.id).delete();
            await db.categories.where('projectId').equals(p.id).delete();
            await db.fieldValues.where('projectId').equals(p.id).delete();
            
            try {
                if (data.bugs) await db.bugs.bulkPut(data.bugs.map(b => ({ ...b, projectId: p.id })));
                if (data.testCases) await db.testCases.bulkPut(data.testCases.map(tc => ({ ...tc, projectId: p.id })));
                if (data.predefinedSteps) await db.predefinedSteps.bulkPut(data.predefinedSteps.map(s => ({ ...s, projectId: p.id })));
                if (data.categories) await db.categories.put({ id: 'categories', projectId: p.id, list: data.categories });
                if (data.fieldValues) await db.fieldValues.put({ projectId: p.id, ...data.fieldValues });
            } catch (err) {
                console.error('Error al importar datos del proyecto:', err);
                showNotification(`Error al importar datos: ${err.message}`, 'error');
            }
            
            if (!currentProject || currentProject.id !== p.id) {
                if (confirm(`¿Desea activar el proyecto "${p.name}" ahora?`)) {
                    projects.forEach(pr => pr.isActive = false);
                    p.isActive = true;
                    saveProjects();
                    currentProject = p;
                }
            }
        } else {
            showNotification('Formato de archivo no reconocido. Debe ser un backup completo o un proyecto individual.', 'error');
            return;
        }
        
        await loadAllData();
        updateProjectsList();
        updateProjectSelector();
        updateBugList();
        renderTestCasesTable();
        updatePredefinedStepsList();
        updateCategoriesList();
        populateAllEnvironmentSelects();
        updateCharts();
        showNotification('Importación completada', 'success');
        
    } catch(ex) {
        console.error('Error en importación:', ex);
        showNotification('Error al importar: ' + ex.message, 'error');
    }
};
reader.readAsText(file);
}

function clearOldData() {
showNotification('Función no implementada aún', 'info');
}

// ==================== FUNCIONES DE PDF ====================
function setupPDF() {
document.getElementById('generatePDF').addEventListener('click', generatePDF);
document.getElementById('clearAll').addEventListener('click', clearAllBugs);
}

function drawSummaryTable(pdf, data, title, headers, x, y, colWidths) {
pdf.setFontSize(14);
pdf.setTextColor(44, 62, 80);
pdf.text(title, x, y);
y += 8;

pdf.setFillColor(52, 152, 219);
pdf.setTextColor(255, 255, 255);
pdf.setFontSize(10);
let currentX = x;
for (let i = 0; i < headers.length; i++) {
    pdf.rect(currentX, y, colWidths[i], 7, 'F');
    pdf.text(headers[i], currentX + 2, y + 5);
    currentX += colWidths[i];
}
y += 7;

pdf.setTextColor(0, 0, 0);
pdf.setFontSize(9);
let rowCount = 0;
for (const row of data) {
    currentX = x;
    for (let i = 0; i < row.length; i++) {
        pdf.text(row[i].toString(), currentX + 2, y + 4);
        currentX += colWidths[i];
    }
    y += 6;
    rowCount++;
    if (rowCount % 2 === 0) {
        pdf.setDrawColor(200, 200, 200);
        pdf.line(x, y - 2, x + colWidths.reduce((a,b) => a+b, 0), y - 2);
    }
}

return y;
}

function generatePDF() {
if (bugs.length === 0 && testCases.length === 0) { 
    showNotification('No hay reportes ni casos de prueba para exportar', 'warning'); 
    return; 
}

let bugsToExport = bugs;
const filter = document.getElementById('reportFilter').value;
if (filter !== 'todos') { 
    bugsToExport = bugs.filter(b => b.status === filter); 
    if (bugsToExport.length === 0 && testCases.length === 0) { 
        showNotification(`Sin reportes con estado ${filter}`, 'warning'); 
        return; 
    }
}

const btn = document.getElementById('generatePDF');
const orig = btn.innerHTML;
btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...'; 
btn.disabled = true;

try {
    const { jsPDF } = window.jspdf;
    // Usar fuente Times para simular LaTeX
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true,
        floatPrecision: 16
    });
    pdf.setFont('Times', 'normal');
    
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 15;
    let page = 0;
    const projectName = currentProject ? currentProject.name : "Proyecto";
    const title = document.getElementById('reportTitle').value || "Reporte de Aseguramiento de Calidad (QA)";
    const subtitle = document.getElementById('reportSubtitle').value || "";
    
    function addFooter(pdf, cur, tot) {
        pdf.setDrawColor(234,234,234); 
        pdf.line(margin, pageHeight-15, pageWidth-margin, pageHeight-15);
        pdf.setFontSize(9); 
        pdf.setTextColor(85,85,85);
        pdf.text('FIBEX TELECOM', margin, pageHeight-5);
        if (subtitle) pdf.text(subtitle, margin+70, pageHeight-5);
        pdf.text(`Página ${cur} de ${tot}`, pageWidth-margin-30, pageHeight-5);
    }
    
    let totalPages = 1;
    if (testCases.length > 0) totalPages++;
    totalPages += bugsToExport.length;
    
    // Título principal con estilo LaTeX (solo texto, sin comandos visibles)
    pdf.setFontSize(20);
    pdf.setTextColor(44,62,80);
    pdf.text('Resumen de Reportes', margin, 20);
    
    let yPos = 35;
    
    if (testCases.length > 0) {
        const tcStatuses = ['Passed', 'Failed', 'Blocked', 'Not Executed'];
        const tcCounts = tcStatuses.map(s => testCases.filter(tc => tc.status === s).length);
        const totalTC = tcCounts.reduce((a,b) => a+b, 0);
        
        const tableData = tcStatuses.map((status, index) => {
            const count = tcCounts[index];
            const percent = totalTC > 0 ? ((count / totalTC) * 100).toFixed(1) + '%' : '0%';
            return [status, count.toString(), percent];
        });
        
        yPos = drawSummaryTable(pdf, tableData, 'Resumen de Casos de Prueba', ['Estado', 'Cantidad', '%'], margin, yPos, [60, 40, 40]) + 5;
    }
    
    if (bugs.length > 0) {
        const bugStatuses = ['Nuevo', 'Asignado', 'Resuelto', 'Cerrado'];
        const bugCounts = bugStatuses.map(s => bugs.filter(b => b.status === s).length);
        
        const tableData = bugStatuses.map((status, index) => [status, bugCounts[index].toString()]);
        
        yPos = drawSummaryTable(pdf, tableData, 'Resumen de Reportes por Estado', ['Estado', 'Cantidad'], margin, yPos, [60, 40]) + 5;
    }
    
    if (bugs.length > 0) {
        const envs = ['Testing', 'Producción', 'Desarrollo', 'Staging'];
        const envCounts = envs.map(e => bugs.filter(b => b.environment === e).length);
        
        const tableData = envs.map((env, index) => [env, envCounts[index].toString()]);
        
        yPos = drawSummaryTable(pdf, tableData, 'Resumen de Reportes por Entorno', ['Entorno', 'Cantidad'], margin, yPos, [60, 40]) + 5;
    }
    
    addFooter(pdf, page+1, totalPages);
    page++;
    
    if (testCases.length > 0) {
        pdf.addPage('l');
        page++;
        
        pdf.setFontSize(20);
        pdf.setTextColor(44,62,80);
        pdf.text('Casos de Prueba', margin, 25);
        
        const columns = [
            { header: 'ID', dataKey: 'id' },
            { header: 'Título', dataKey: 'title' },
            { header: 'Precondiciones', dataKey: 'preconditions' },
            { header: 'Pasos', dataKey: 'steps' },
            { header: 'Resultado Esperado', dataKey: 'expected' },
            { header: 'Resultado Obtenido', dataKey: 'actual' },
            { header: 'Estado', dataKey: 'status' }
        ];
        
        const rows = testCases.map(tc => {
            let stepsText = '';
            if (tc.steps && tc.steps.length) {
                stepsText = tc.steps.map((s, i) => {
                    let line = `${i+1}. ${s.description}`;
                    if (s.expected) line += `\n   Esp: ${s.expected}`;
                    if (s.data) line += `\n   Dat: ${s.data}`;
                    return line;
                }).join('\n');
            }
            return {
                id: tc.id,
                title: tc.title || '',
                preconditions: tc.preconditions || '',
                steps: stepsText,
                expected: tc.expectedResults || '',
                actual: tc.actualResult || '',
                status: tc.status || 'Not Executed'
            };
        });
        
        pdf.autoTable({
            startY: 35,
            head: [columns.map(col => col.header)],
            body: rows.map(row => columns.map(col => row[col.dataKey])),
            theme: 'striped',
            headStyles: { fillColor: [52, 152, 219], textColor: 255, fontSize: 10, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8, font: 'Times' },
            columnStyles: {
                id: { cellWidth: 20 },
                title: { cellWidth: 50 },
                preconditions: { cellWidth: 45 },
                steps: { cellWidth: 80 },
                expected: { cellWidth: 45 },
                actual: { cellWidth: 45 },
                status: { cellWidth: 25 }
            },
            margin: { left: margin, right: margin },
            didDrawPage: function(data) {
                pdf.setFontSize(9);
                pdf.setTextColor(150,150,150);
                pdf.text(`Página ${data.pageNumber}`, pageWidth-30, pageHeight-10);
            }
        });
        
        addFooter(pdf, page+1, totalPages);
    }
    
    if (bugsToExport.length > 0) {
        bugsToExport.forEach((bug, i) => {
            pdf.addPage('l');
            page++;
            
            pdf.setFillColor(44,62,80); 
            pdf.rect(0,0,pageWidth,25,'F');
            pdf.setTextColor(255,255,255); 
            pdf.setFontSize(16); 
            pdf.text(title, margin, 15);
            pdf.setFontSize(11); 
            pdf.text(`Proyecto: ${projectName}`, margin, 22);
            
            pdf.setFillColor(248,249,250); 
            pdf.rect(0,25,pageWidth,10,'F');
            pdf.setTextColor(52,152,219); 
            pdf.setFontSize(14);
            let reportDetailTitle = "Detalle del Error";
            if (bug.category === 'Test Case (caso de éxito)') reportDetailTitle = "Caso de Prueba - Detalle";
            else if (bug.category === 'Exploratorio') reportDetailTitle = "Prueba Exploratoria - Detalle";
            else if (bug.category === 'Mejora') reportDetailTitle = "Sugerencia de Mejora - Detalle";
            pdf.text(reportDetailTitle, margin, 32);
            
            let y = 45;
            
            pdf.setTextColor(0,0,0); 
            pdf.setFontSize(16); 
            const titleLines = pdf.splitTextToSize(`${i+1}. ${bug.title}`, pageWidth - 2*margin - 10);
            for (let line of titleLines) {
                pdf.text(line, margin, y);
                y += 7;
            }
            y += 2;
            
            pdf.setFontSize(9); 
            pdf.setTextColor(100,100,100);
            const date = new Date(bug.createdDate).toLocaleDateString('es-ES');
            pdf.text(`ID: #${bug.id.toString().slice(-6)} | Fecha: ${date} | Frecuencia: ${bug.frequency} | Categoría: ${bug.category}`, margin, y); 
            y += 6;
            
            let statusColor = bug.status === 'Asignado' ? '#f39c12' : bug.status === 'Resuelto' ? '#27ae60' : bug.status === 'Cerrado' ? '#7f8c8d' : '#3498db';
            pdf.setFillColor(statusColor);
            pdf.roundedRect(margin, y, 20, 7, 2, 2, 'F');
            pdf.setTextColor(255,255,255); 
            pdf.setFontSize(8); 
            pdf.text(bug.status, margin+2, y+5); 
            y += 12;
            
            pdf.setDrawColor(234,234,234); 
            pdf.line(margin, y, pageWidth-margin, y); 
            y += 5;
            
            pdf.setFontSize(12); 
            pdf.setTextColor(44,62,80); 
            pdf.text('Información del Entorno', margin, y); 
            y += 6;
            pdf.setFontSize(9); 
            pdf.setTextColor(85,85,85);
            const envs = [ [`Versión: ${bug.version}`, `SO: ${bug.os}`], [`Navegador: ${bug.browser}`, `Entorno: ${bug.environment}`] ];
            if (bug.device) envs.push([`Dispositivo: ${bug.device}`, `Resolución: ${bug.resolution || 'N/A'}`]);
            if (bug.build) envs.push([`Build: ${bug.build}`, '']);
            envs.forEach(row => { 
                pdf.text(row[0], margin, y); 
                if (row[1]) pdf.text(row[1], margin+100, y); 
                y += 5; 
            });
            y += 2; 
            pdf.line(margin, y, pageWidth-margin, y); 
            y += 5;
            
            pdf.setFontSize(12); 
            pdf.setTextColor(44,62,80); 
            pdf.text('Pasos para Reproducir', margin, y); 
            y += 6;
            pdf.setFontSize(9); 
            pdf.setTextColor(85,85,85);
            const steps = bug.steps.split('\n');
            for (let step of steps) { 
                if (step.trim()) { 
                    const lines = pdf.splitTextToSize(step.trim(), pageWidth-2*margin-10); 
                    for (let line of lines) { 
                        if (y + 4 > pageHeight - 25) {
                            pdf.addPage('l'); 
                            page++;
                            y = 30;
                            addFooter(pdf, page+1, totalPages);
                        }
                        pdf.text(line, margin+3, y); 
                        y += 4; 
                    } 
                } 
            }
            y += 2; 
            pdf.line(margin, y, pageWidth-margin, y); 
            y += 5;
            
            pdf.setFontSize(12); 
            pdf.setTextColor(44,62,80); 
            pdf.text('Resultados', margin, y); 
            y += 6;
            pdf.setFontSize(10); 
            pdf.setTextColor(52,152,219); 
            pdf.text('Esperado:', margin, y); 
            y += 5;
            pdf.setFontSize(9); 
            pdf.setTextColor(85,85,85);
            const expLines = pdf.splitTextToSize(bug.expected, pageWidth-2*margin-10);
            for (let line of expLines) { 
                if (y + 4 > pageHeight - 25) {
                    pdf.addPage('l'); 
                    page++;
                    y = 30;
                    addFooter(pdf, page+1, totalPages);
                }
                pdf.text(line, margin+3, y); 
                y += 4; 
            } 
            y += 3;
            
            pdf.setFontSize(10); 
            pdf.setTextColor(231,76,60); 
            pdf.text('Actual:', margin, y); 
            y += 5;
            pdf.setFontSize(9); 
            pdf.setTextColor(85,85,85);
            const actLines = pdf.splitTextToSize(bug.actual, pageWidth-2*margin-10);
            for (let line of actLines) { 
                if (y + 4 > pageHeight - 25) {
                    pdf.addPage('l'); 
                    page++;
                    y = 30;
                    addFooter(pdf, page+1, totalPages);
                }
                pdf.text(line, margin+3, y); 
                y += 4; 
            } 
            y += 5;
            
            if (bug.notes && bug.notes.trim()) {
                const noteLines = pdf.splitTextToSize(bug.notes, pageWidth-2*margin-10);
                if (y + noteLines.length*4 + 15 > pageHeight - 25) {
                    pdf.addPage('l'); 
                    page++;
                    y = 30;
                }
                pdf.line(margin, y, pageWidth-margin, y); 
                y += 5;
                pdf.setFontSize(12); 
                pdf.setTextColor(44,62,80); 
                pdf.text('Notas Adicionales', margin, y); 
                y += 6;
                pdf.setFontSize(9); 
                pdf.setTextColor(85,85,85);
                for (let line of noteLines) { 
                    pdf.text(line, margin, y); 
                    y += 4; 
                }
                y += 5;
            }
            
            addFooter(pdf, page+1, totalPages);
            
            if (bug.images && bug.images.length) {
                bug.images.forEach((img, idx) => {
                    pdf.addPage('l'); 
                    page++;
                    pdf.setFontSize(14); 
                    pdf.setTextColor(44,62,80); 
                    pdf.text(`Evidencia ${idx+1} de ${bug.images.length}`, margin, 25);
                    
                    const maxW = pageWidth - 2*margin - 20;
                    const maxH = pageHeight - 60;
                    let w = maxW, h = maxH;
                    const ratio = 4/3; 
                    if (w/h > ratio) w = h*ratio; else h = w/ratio;
                    const x = (pageWidth - w)/2; 
                    const yImg = 40 + (maxH - h)/2;
                    try {
                        pdf.setDrawColor(200,200,200); 
                        pdf.setFillColor(250,250,250);
                        pdf.roundedRect(x-3, yImg-3, w+6, h+6, 2, 2, 'FD');
                        let imgFormat = 'JPEG';
                        if (img.data.startsWith('data:image/png')) imgFormat = 'PNG';
                        pdf.addImage(img.data, imgFormat, x, yImg, w, h);
                    } catch(err) {
                        pdf.setTextColor(231,76,60); 
                        pdf.text('Error al cargar imagen', pageWidth/2, yImg+h/2, {align:'center'});
                    }
                    addFooter(pdf, page+1, totalPages);
                });
            }
        });
    }
    
    pdf.save(`Reporte_QA_${projectName.replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    showNotification('PDF generado con estilo LaTeX', 'success');
    
} catch(err) { 
    showNotification('Error al generar PDF: '+err.message,'error'); 
} finally { 
    btn.innerHTML = orig; 
    btn.disabled = false; 
}
}

async function clearAllBugs() {
if (bugs.length === 0) { showNotification('No hay reportes','warning'); return; }
if (confirm(`¿Eliminar todos los reportes (${bugs.length}) del proyecto actual?`)) {
    if (editingBugId) cancelEdit();
    bugs = bugs.filter(b => b.projectId !== currentProject.id);
    await saveAllData();
    updateBugList();
    updateCharts();
    showNotification('Todos los reportes eliminados','success');
}
}

// ==================== FUNCIONES AUXILIARES ====================
function checkStorageSpace() {
try {
    let total = 0;
    for (let i=0; i<localStorage.length; i++) { const k = localStorage.key(i); const v = localStorage.getItem(k); total += (k.length + v.length)*2; }
    const mb = (total / (1024*1024)).toFixed(2);
    const percent = (total / (5*1024*1024))*100;
    const status = document.getElementById('storageStatus');
    if (status) {
        status.innerHTML = `Usando localStorage: ${mb} MB / 5 MB (${percent.toFixed(1)}%) <div style="height:5px; background:#e0e0e0; margin-top:5px; border-radius:3px;"><div style="height:100%; width:${Math.min(percent,100)}%; background:${percent>80?'#e74c3c':percent>60?'#f39c12':'#27ae60'}; border-radius:3px;"></div></div><br><span style="color:#3498db;">✅ IndexedDB: almacenamiento ilimitado para reportes e imágenes</span>`;
    }
    const warn = document.getElementById('storageWarning');
    if (warn) warn.style.display = 'none';
} catch(e) {}
}

function showNotification(msg, type='info') {
const n = document.createElement('div');
n.style.cssText = `position:fixed; top:20px; right:20px; padding:15px 20px; border-radius:6px; color:white; font-weight:600; z-index:10000; box-shadow:0 4px 12px rgba(0,0,0,0.15); animation:slideIn 0.3s; background:${type==='success'?'#27ae60':type==='error'?'#e74c3c':type==='warning'?'#f39c12':'#3498db'};`;
n.textContent = msg;
document.body.appendChild(n);
setTimeout(() => { n.style.animation = 'slideOut 0.3s'; setTimeout(() => { if (n.parentNode) n.parentNode.removeChild(n); }, 300); }, 3000);
if (!document.getElementById('notificationStyles')) {
    const style = document.createElement('style'); style.id = 'notificationStyles';
    style.textContent = `@keyframes slideIn{from{transform:translateX(100%);opacity:0;}to{transform:translateX(0);opacity:1;}}@keyframes slideOut{from{transform:translateX(0);opacity:1;}to{transform:translateX(100%);opacity:0;}}`;
    document.head.appendChild(style);
}
}

function setupMainNavigation() {
const navTabs = document.querySelectorAll('.nav-tab');
navTabs.forEach(tab => {
    tab.addEventListener('click', function() {
        const tabId = this.getAttribute('data-tab');
        navTabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.tab-content-section').forEach(c => c.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        if (tabId === 'projects-management') {
            setTimeout(updateCharts, 100);
        }
    });
});
}

// ==================== INICIALIZACIÓN ====================
async function initApp() {
loadProjects();
if (projects.length === 0) createDefaultProject();
setActiveProject();
await loadAllData();
await loadPlaywrightTests();
setupMainNavigation();
setupBugReportForm();
setupTestCaseForm();
setupPredefinedSteps();
setupProjectsManagement();
setupModals();
setupPDF();
setupKeyboardShortcuts();
setupPasteImage();

updateBugList();
renderTestCasesTable();
updatePredefinedStepsList();
updateCategoriesList();
updateProjectsList();
updateProjectSelector();

const now = new Date();
const formattedDate = now.toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
document.getElementById('reportDate').value = formattedDate;

checkStorageSpace();
populateAllEnvironmentSelects();

document.getElementById('exportTestCasesPDFBtn').addEventListener('click', generateTestCasesPDF);

// ==================== PLAYWRIGHT TESTS EVENT LISTENERS ====================
document.getElementById('runAllTestsBtn').addEventListener('click', runAllPlaywrightTests);
document.getElementById('importResultsBtn').addEventListener('click', importPlaywrightResults);
document.getElementById('refreshTestsBtn').addEventListener('click', refreshPlaywrightTests);
document.getElementById('playwrightProjectFilter').addEventListener('change', renderPlaywrightTestsTable);
}

initApp().catch(err => console.error('Error en initApp:', err));


