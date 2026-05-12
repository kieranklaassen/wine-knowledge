const { test, expect } = require("playwright/test");

test("atlas interactions work", async ({ page }) => {
  await page.goto("http://localhost:8000/map/");

  await expect(page.locator(".wine-svg-marker")).toHaveCount(266);

  await page.locator("#search-input").fill("Napa");
  await expect(page.locator("#visible-regions")).not.toHaveText("266");

  await page.locator("[data-mode=varieties]").click();
  await expect(page.locator("#active-dataset")).toHaveText("Varieties");
  await page.locator("#search-input").fill("Pinot");
  await expect(page.locator(".result-item").first()).toContainText(/Pinot/i);

  await page.locator("[data-mode=flavors]").click();
  await page.locator("#search-input").fill("Fruit");
  await expect(page.locator(".result-item").first()).toContainText(/Fruit|Apple|Berry|Citrus/i);

  await page.locator("#variety-strip [data-search]").first().click();
  await expect(page.locator("#active-dataset")).toHaveText("Varieties");

  await page.locator("[data-mode=regions]").click();
  await page.locator("#search-input").fill("");
  await page.locator("#state-filter").selectOption("CA");
  await expect(page.locator("#selected-state-label")).toHaveText("CA spotlight");

  await page.locator(".wine-svg-marker").first().click({ force: true });
  await expect(page.locator("#detail-content")).toContainText(/wine region|Hierarchy/);
});
