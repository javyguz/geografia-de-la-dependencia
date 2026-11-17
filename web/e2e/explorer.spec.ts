import { expect, test } from "@playwright/test";

test("the map loads without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on(
    "response",
    (r) => r.status() === 404 && errors.push(`404 ${r.url()}`),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Nacional" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  expect(errors).toEqual([]);
});

test("searching an entity selects it and writes it to the URL", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Buscar entidad" }).click();
  await page.getByPlaceholder("Nombre de la entidad").fill("mexico");
  await page.getByRole("option", { name: "Ciudad de México" }).click();
  await expect(
    page.getByRole("heading", { name: "Ciudad de México" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/[?&]t=09/);
});

test("a shared URL restores layer and territory", async ({ page }) => {
  await page.goto("/?capa=value_split&ind=labor_share&anio=2018&t=19");
  await expect(page.getByRole("heading", { name: "Nuevo León" })).toBeVisible();
  await expect(page.getByLabel("Año")).toContainText("2018");
});

test("the table shows every entity", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ver como tabla" }).click();
  await expect(page.getByRole("dialog").getByRole("row")).toHaveCount(34);
});
