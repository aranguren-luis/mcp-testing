# /results

Ver resultados de tests recientes y sus screenshots.

## Usage

```
/results           # Ver último resultado
/results --all     # Ver todos los resultados recientes
/results <ID>      # Ver resultado específico de YouTrack
```

## Behavior

1. Leer `test-results.json`
2. Mostrar resumen de tests ejecutados
3. Listar screenshots disponibles en `test-results/`
4. Si se especifica ID de YouTrack: mostrar enlace al issue

## Example Output

```
📊 Resultados Recientes

Test: nuevo-test.spec.js
Estado: ✅ PASSED (2.1s)
Screenshot: test-results/nuevo-test-test/test-finished-1.png
YouTrack: CP-118

📁 Screenshots disponibles:
  - test-results/nuevo-test-test/test-finished-1.png (41KB)
  - test-results/nuevo-test-test/trace.zip (215KB)
```
