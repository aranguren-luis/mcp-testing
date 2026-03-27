# /upload

Subir resultados de tests a YouTrack con análisis de QA.

## Usage

```
/upload           # Subir resultados del último test
/upload --force   # Forzar regeneración del reporte antes de subir
```

## Behavior

1. Verificar que exista `test-results.json`
2. Si no existe o está desactualizado: ejecutar tests primero
3. Ejecutar `node upload-to-youtrack.js`
4. Mostrar IDs de casos de prueba creados en YouTrack
5. Confirmar que screenshots fueron adjuntados

## Example Output

```
✅ Subiendo resultados a YouTrack...
✅ Issue CP-119 creado con análisis de QA.
📸 Evidencia adjuntada a CP-119
📎 Ver en YouTrack: https://fibex.youtrack.cloud/issue/CP-119
```

## Notes

- Requiere variables de entorno YOUTRACK_BASE_URL y YOUTRACK_TOKEN
- Genera IDs de casos de prueba incrementales (CP-XXX)
- Incluye screenshots automáticamente
