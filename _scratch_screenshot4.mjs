import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

await page.goto("http://localhost:3000/prices");
await page.fill('input[placeholder="e.g. FC 26"]', "FC 26");
await page.getByRole("button", { name: "Search" }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: "/tmp/shots/prices-search-results.png" });

await page.getByRole("button", { name: /EA SPORTS FC.*26$/ }).first().click();
await page.waitForTimeout(2000);
await page.screenshot({ path: "/tmp/shots/prices-region-table.png" });

await browser.close();
console.log("done");
