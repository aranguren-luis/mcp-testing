# /codegen

Grabar nuevo test de Playwright usando codegen.

## Usage

```
/codegen                    # Grabar sin URL específica
/codegen <URL>              # Grabar test en URL específica
/codegen <URL> --name <n>   # Grabar con nombre personalizado
```

## Examples

```
/codegen
/codegen https://example.com/login
/codegen https://dashboardtoques-fibex-analytics-develop.up.railway.app/login --name flujo-login
```

## Behavior

1. Si se proporciona URL: usar esa URL
2. Si no hay URL: preguntar al usuario
3. Si se proporciona --name: guardar como `tests/<nombre>.spec.js`
4. Si no hay nombre: usar timestamp o preguntar
5. Ejecutar: `npx playwright codegen -o tests/<nombre>.spec.js <URL>`
6. Esperar a que el usuario termine la grabación
7. Confirmar archivo creado y mostrar contenido resumido

## Post-Recording

Después de grabar, sugerir:
- Revisar el código generado
- Ejecutar con `/test <nombre>.spec.js` para verificar
- Subir a YouTrack con `/upload` cuando esté listo
