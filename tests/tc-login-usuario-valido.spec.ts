import { test, expect } from '@playwright/test';

test.describe('Login de Usuario', () => {
  test('TC-Login: Usuario válido puede iniciar sesión exitosamente', async ({ page }) => {

    // ============================================
    // CASO DE PRUEBA: Login con credenciales válidas
    // Precondición: El usuario existe en el sistema
    // Datos de prueba:
    //   - Correo: laranguren@fibextelecom.net
    //   - Contraseña: 123456789
    // ============================================

    await test.step('1. Navegar a la página de login', async () => {
      await page.goto('https://dashboardtoques-fibex-analytics-develop.up.railway.app/login');

      // Verificar que la página cargó correctamente
      await expect(page).toHaveURL(/.*login/);
      await expect(page.getByRole('heading', { name: /bienvenido/i })).toBeVisible();
    });

    await test.step('2. Ingresar credenciales', async () => {
      // Ingresar email
      const emailInput = page.getByRole('textbox', { name: /correo electrónico/i });
      await emailInput.fill('laranguren@fibextelecom.net');
      await expect(emailInput).toHaveValue('laranguren@fibextelecom.net');

      // Ingresar contraseña
      const passwordInput = page.getByRole('textbox', { name: /contraseña/i });
      await passwordInput.fill('123456789');
      await expect(passwordInput).toHaveValue('123456789');
    });

    await test.step('3. Enviar formulario y esperar redirección', async () => {
      const loginButton = page.getByRole('button', { name: /iniciar sesión/i });
      await expect(loginButton).toBeEnabled();

      // Click en login y esperar navegación simultáneamente
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }),
        loginButton.click()
      ]);
    });

    await test.step('4. Verificar autenticación exitosa', async () => {
      // Verificar que ya no estamos en /login
      await expect(page).not.toHaveURL(/.*login/);

      // La URL actual debe ser diferente (dashboard/home)
      const currentUrl = page.url();
      console.log('✅ Login exitoso - Redirigido a:', currentUrl);
    });
  });
});
