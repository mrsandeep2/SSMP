import { test, expect } from "@playwright/test";

test("hero search navigates to services", async ({ page }) => {
  await page.goto("/");

  const searchInput = page.getByPlaceholder(
    "Search in any language... e.g. 'electrician', 'plumbing near me'"
  );
  await searchInput.fill("electrician");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/\/services\?q=/);
});

test("become a provider preselects role", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Become a Provider/i }).click();
  await expect(page).toHaveURL(/\/register\?role=provider/);

  await expect(
    page.getByRole("button", { name: /Create Provider Account/i })
  ).toBeVisible();
});
