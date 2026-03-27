# TC-Login-Usuario-Válido

## Información General
- **ID:** TC-001
- **Título:** Login con credenciales válidas
- **Tipo:** Funcional - Autenticación
- **Prioridad:** Alta
- **Estado:** Automatizado ✅

---

## Descripción
Verificar que un usuario registrado puede iniciar sesión exitosamente ingresando sus credenciales válidas y acceder al sistema.

---

## Precondiciones
1. El usuario debe existir en el sistema
2. El usuario debe tener credenciales activas (no bloqueadas)
3. La aplicación debe estar accesible

---

## Datos de Prueba

| Campo | Valor |
|-------|-------|
| **URL** | https://dashboardtoques-fibex-analytics-develop.up.railway.app/login |
| **Correo Electrónico** | laranguren@fibextelecom.net |
| **Contraseña** | 123456789 |

---

## Pasos de Ejecución

### Paso 1: Navegar a la página de login
**Acción:** Abrir la URL de login en el navegador

**Resultado Esperado:**
- Se muestra la página de inicio de sesión
- Aparece el título "Bienvenido al Sistema de Registro de Toques"
- Se visualizan los campos para ingresar credenciales

---

### Paso 2: Ingresar correo electrónico
**Acción:** Hacer clic en el campo de correo y escribir el email del usuario

**Entrada:** `laranguren@fibextelecom.net`

**Resultado Esperado:**
- El campo de correo muestra el texto ingresado

---

### Paso 3: Ingresar contraseña
**Acción:** Hacer clic en el campo de contraseña y escribir la contraseña del usuario

**Entrada:** `123456789`

**Resultado Esperado:**
- El campo de contraseña muestra los caracteres enmascarados

---

### Paso 4: Enviar formulario
**Acción:** Hacer clic en el botón "Iniciar Sesión"

**Resultado Esperado:**
- El botón cambia a estado "Iniciando..." y se deshabilita temporalmente
- El sistema procesa la autenticación

---

### Paso 5: Verificar redirección
**Acción:** Esperar la respuesta del sistema

**Resultado Esperado:**
- El usuario es redirigido automáticamente al dashboard principal
- La URL cambia de `/login` a `/` (raíz del sitio)
- Se muestra la interfaz principal de la aplicación

---

## Resultado Obtenido
✅ **APROBADO**

El sistema autenticó correctamente al usuario y realizó la redirección al dashboard sin errores.

**Evidencia:**
- Screenshot: test-results/tc-login-usuario-valido.../test-finished-1.png
- Trace: Disponible para análisis detallado

---

## Notas
- Tiempo de ejecución: ~30 segundos
- El sistema muestra indicador visual "Iniciando..." durante el proceso
- No se observaron mensajes de error durante la ejecución

---

**Última ejecución:** 2026-03-25
**Archivo de test:** `tests/tc-login-usuario-valido.spec.ts`
