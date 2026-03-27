import { test, expect } from '@playwright/test';

test('inspeccionar página de login', async ({ page }) => {
  await page.goto('https://dashboardtoques-fibex-analytics-develop.up.railway.app/login');

  // Esperar carga completa
  await page.waitForLoadState('networkidle');

  // Inspeccionar título de la página
  console.log('Título:', await page.title());

  // Buscar inputs
  const inputs = await page.locator('input').all();
  console.log(`\nInputs encontrados: ${inputs.length}`);
  for (const input of inputs) {
    const type = await input.getAttribute('type');
    const placeholder = await input.getAttribute('placeholder');
    const label = await input.getAttribute('aria-label');
    console.log(`  - type: ${type}, placeholder: ${placeholder}, aria-label: ${label}`);
  }

  // Buscar botones
  const buttons = await page.locator('button').all();
  console.log(`\nBotones encontrados: ${buttons.length}`);
  for (const btn of buttons) {
    const text = await btn.textContent();
    const ariaLabel = await btn.getAttribute('aria-label');
    console.log(`  - text: "${text?.trim()}", aria-label: ${ariaLabel}`);
  }

  // Buscar headings
  const headings = await page.locator('h1, h2, h3').all();
  console.log(`\nHeadings encontrados: ${headings.length}`);
  for (const h of headings) {
    const text = await h.textContent();
    console.log(`  - "${text?.trim()}"`);
  }

  // Tomar screenshot para análisis
  await page.screenshot({ path: 'test-results/inspect-login.png', fullPage: true });
});
