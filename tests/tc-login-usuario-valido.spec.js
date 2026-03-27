import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://dashboardtoques-fibex-analytics-develop.up.railway.app/login');
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  await page.getByRole('button', { name: 'Cancelar' }).click();
});