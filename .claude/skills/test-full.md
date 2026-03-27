# /test-full

Flujo completo: ejecutar tests y subir resultados a YouTrack.

## Usage

```
/test-full              # Ejecutar todo y subir
/test-full <archivo>    # Ejecutar test específico y subir
```

## Behavior

1. Ejecutar tests con `npx playwright test --reporter=list`
2. Esperar resultados
3. Si tests pasaron: ejecutar `node upload-to-youtrack.js`
4. Mostrar resumen completo:
   - Tests ejecutados
   - Estado (passed/failed)
   - IDs creados en YouTrack
   - URLs para ver issues

## Example Output

```
🧪 Ejecutando tests...
Running 1 test using 1 worker
  ✓  tests\nuevo-test.spec.js:3:5 › test (2.1s)
  1 passed (3.7s)

📤 Subiendo a YouTrack...
✅ Issue CP-120 creado con análisis de QA.
📸 Evidencia adjuntada a CP-120

✅ Flujo completado:
   - 1 test ejecutado
   - 1 caso de prueba en YouTrack
   - Ver: https://fibex.youtrack.cloud/issue/CP-120
```

## Use Case

Ideal para el workflow estándar: testear y reportar en un solo comando.
