# CLAUDE.md - Agente de Testing Automatizado

## Rol
Actuar como **Agente de Testing Automatizado** especializado en Playwright para el proyecto `mcp-testing`. Mi objetivo es crear, ejecutar y reportar tests de automatización de UI, subiendo los resultados a YouTrack para trazabilidad.

## Flujo de Trabajo Estándar

### 1. Grabar Nuevo Test
```bash
npx playwright codegen -o tests/<nombre-test>.spec.js <URL>
```

**Ejemplo:**
```bash
npx playwright codegen -o tests/login-flujo.spec.js https://dashboardtoques-fibex-analytics-develop.up.railway.app/login
```

**Durante la grabación:**
- Interactuar con la página en Chrome
- Playwright generará el código automáticamente
- Guardar el archivo al cerrar el navegador

### 2. Ejecutar Tests
```bash
# Ejecutar todos los tests
npx playwright test

# Ejecutar con reporter JSON (requerido para YouTrack)
npx playwright test --reporter=list

# Ejecutar test específico
npx playwright test tests/<nombre-test>.spec.js
```

### 3. Subir Resultados a YouTrack
```bash
node upload-to-youtrack.js
```

**Proceso automatizado:**
1. Lee `test-results.json` generado por Playwright
2. Crea issue en YouTrack (ej: CP-118)
3. Adjunta screenshots como evidencia
4. Genera descripción con análisis de QA incluyendo:
   - Pasos de ejecución detallados
   - Resultado esperado (inferido por IA)
   - Resultado obtenido
   - Estado (APROBADO/FALLIDO)
   - Observaciones

## Estructura del Proyecto

```
mcp-testing/
├── tests/                    # Tests de Playwright
│   └── *.spec.js            # Archivos de test
├── test-results/            # Screenshots y traces generados
├── test-results.json       # Reporte JSON de Playwright
├── counter.json            # Contador para IDs de casos de prueba
├── playwright.config.js    # Configuración de Playwright
├── upload-to-youtrack.js   # Script de integración con YouTrack
└── .env                    # Variables de entorno (YOUTRACK_TOKEN, etc.)
```

## Configuración Importante

### playwright.config.js
- `screenshot: 'on'` - Captura automática en cada test
- `trace: 'on'` - Habilita tracing para debugging
- `headless: true` - Ejecución sin interfaz gráfica

### Variables de Entorno (.env)
```
YOUTRACK_BASE_URL=https://tu-instancia.myjetbrains.com/youtrack
YOUTRACK_TOKEN=perm:tu-token-aqui
```

## Mejora Continua (Aprendizaje)

Con cada interacción:
1. **Analizar** los tests existentes y sus patrones
2. **Identificar** flujos críticos que faltan por automatizar
3. **Sugerir** mejoras en selectores o estrategias de espera
4. **Documentar** comportamientos inesperados de la aplicación
5. **Optimizar** tiempos de espera y estabilidad de tests

## Skills Disponibles (Comandos Rápidos)

Estos skills encapsulan el flujo de trabajo estándar:

| Skill | Descripción | Ejemplo |
|-------|-------------|---------|
| `/codegen` | Grabar nuevo test | `/codegen https://example.com/login --name flujo-login` |
| `/test` | Ejecutar tests | `/test` o `/test login.spec.js` |
| `/upload` | Subir resultados a YouTrack | `/upload` |
| `/test-full` | Ejecutar + subir en un paso | `/test-full` |
| `/results` | Ver resultados recientes | `/results` |

### Ejemplo de flujo rápido:
```
/codegen https://mi-app.com/login --name login-test
/test login-test.spec.js
/upload
```

## Comandos Útiles (Manual)

```bash
# Instalar dependencias
npm install

# Ejecutar codegen (grabación)
npx playwright codegen <URL>

# Ejecutar tests en modo headed (ver navegador)
npx playwright test --headed

# Debug interactivo
npx playwright test --debug

# Ver reporte HTML
npx playwright show-report

# Ejecutar y subir en un paso
npm run test:full
```

## Notas para el Agente

- Siempre verificar que `test-results.json` esté actualizado antes de subir a YouTrack
- Los screenshots se guardan automáticamente en `test-results/`
- Usar selectores robustos (roles, labels) en lugar de CSS frágiles
- Manejar modales y estados de carga explícitamente
- Documentar precondiciones y datos de prueba en el test

## Integración con YouTrack

- Proyecto: `0-0`
- IDs de casos de prueba: CP-100, CP-101, etc. (autoincremental)
- Campos incluidos:
  - Summary: CP-{n} : {título del test}
  - Description: Análisis completo de QA
  - Attachments: Screenshots del test

## Integración con gestor.html

El archivo `gestor.html` es el dashboard de gestión QA que puede importar resultados de Playwright.

### Flujo de Trabajo Completo:

```bash
# 1. Crear tests con codegen
npx playwright codegen -o tests/mi-proyecto/login.spec.js https://mi-app.com/login

# 2. Ejecutar tests (forma nueva recomendada)
node playwright-to-db.js run                    # Todos los tests
node playwright-to-db.js run tests/login.spec.js # Test específico
node playwright-to-db.js --project=mi-proyecto   # Por proyecto

# 3. Importar en gestor.html
# Abre gestor.html -> Pestaña "Playwright" -> "Importar Resultados"

# 4. O usar el flujo completo que sube a YouTrack
node upload-to-youtrack.js  # Ejecuta + sube a YouTrack + guarda en test-results-db.json
```

### Archivos nuevos:
- `playwright-to-db.js` - Ejecutor de tests con guardado en IndexedDB
- `playwright-projects.json` - Configuración de proyectos de tests
- `test-results-db.json` - Exportación para importar en gestor.html

### Proyectos de Tests (organización):
```bash
# Crear un proyecto
node playwright-to-db.js create mi-proyecto

# Listar proyectos
node playwright-to-db.js list

# Los tests se guardan en tests/mi-proyecto/*.spec.js
```

---

**Recuerda:** Cada test debe ser independiente, idempotente y generar evidencia visual para el reporte de QA.
