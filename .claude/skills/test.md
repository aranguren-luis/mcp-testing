# /test

Ejecutar tests de Playwright y mostrar resultados.

## Usage

```
/test              # Ejecutar todos los tests
/test <archivo>    # Ejecutar test específico
/test --headed     # Ejecutar con navegador visible
/test --debug      # Ejecutar en modo debug
```

## Examples

```
/test
/test login.spec.js
/test --headed
```

## Implementation

Cuando el usuario use `/test`:

1. Si no hay argumentos: ejecutar `npx playwright test --reporter=list`
2. Si hay argumento (ej: login.spec.js): ejecutar `npx playwright test tests/<archivo> --reporter=list`
3. Si hay flags: pasarlos al comando
4. Mostrar resumen de resultados (passed/failed)
5. Sugerir usar `/upload` para subir a YouTrack si hay tests completados
