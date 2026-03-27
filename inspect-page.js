const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://dashboardtoques-fibex-analytics-develop.up.railway.app/login');
  const content = await page.content();
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type,
      placeholder: i.placeholder,
      id: i.id,
      name: i.name,
      className: i.className
    }));
  });
  console.log('Inputs encontrados:', JSON.stringify(inputs, null, 2));
  await browser.close();
})();
