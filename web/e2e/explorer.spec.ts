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
  await page.getByRole("button", { name: "Buscar lugar" }).click();
  await page.getByPlaceholder("Entidad o municipio").fill("mexico");
  await page
    .getByRole("option", { name: "Ciudad de México", exact: true })
    .click();
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

test("a municipality opens inside its state, ranked among municipalities", async ({
  page,
}) => {
  await page.goto("/?capa=value_split&t=14039");
  await expect(
    page.getByRole("heading", { name: "Guadalajara" }),
  ).toBeVisible();
  await expect(page.getByText("Municipio, Jalisco")).toBeVisible();
  await expect(page.getByText(/municipios con dato/)).toBeVisible();
  await expect(page.getByText("Por municipio")).toBeVisible();
});

test("a state-only indicator gives a municipality its state's value and says so", async ({
  page,
}) => {
  await page.goto("/?t=14039");
  await expect(
    page.getByText("No se publica por municipio. Valor de Jalisco:"),
  ).toBeVisible();
});

test("search finds municipalities that share a name", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Buscar lugar" }).click();
  await page.getByPlaceholder("Entidad o municipio").fill("juarez");
  await page.getByRole("option", { name: "Juárez Chihuahua" }).click();
  await expect(page).toHaveURL(/[?&]t=08037/);
});

test("the counterargument is one click away and lands in the URL", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "El contraargumento" }).click();
  await expect(
    page.getByRole("heading", { name: "El contraargumento", level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByText(/entidades con dato en los dos grupos/).first(),
  ).toBeVisible();
  await expect(page).toHaveURL(/[?&]panel=contraargumento/);
});

test("compare starts from the selected place and adds another", async ({
  page,
}) => {
  await page.goto("/?t=19");
  await page
    .getByRole("button", { name: "Comparar", exact: true })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Comparar" })).toBeVisible();
  await page.getByRole("button", { name: "Añadir lugar" }).click();
  await page.getByPlaceholder("Entidad o municipio").fill("chiapas");
  await page.getByRole("option", { name: "Chiapas", exact: true }).click();
  await expect(page).toHaveURL(/[?&]cmp=19,07/);
  await expect(
    page.getByRole("columnheader", { name: /Chiapas/ }),
  ).toBeVisible();
});

test("the methodology page describes every indicator of the catalog", async ({
  page,
}) => {
  await page.goto("/metodologia");
  // One entry per indicator of the catalog (20), apart from the sources.
  await expect(page.locator("article[id]:not([id^=fuente-])")).toHaveCount(20);
  await expect(page.locator("#labor_share")).toContainText("Fórmula");
});

/** OpenRouter's streamed replies, one per request: first a tool call, then the answer. */
function openRouterReplies(answer: string) {
  const sse = (chunks: object[]) =>
    `${chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("")}data: [DONE]\n\n`;
  return [
    sse([
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_1",
                  function: {
                    name: "get_value",
                    arguments: '{"indicator":"labor_share","territory":"19"}',
                  },
                },
              ],
            },
          },
        ],
      },
    ]),
    sse([{ choices: [{ delta: { content: answer } }] }]),
  ];
}

test("the assistant asks for a key and works without one", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Preguntar" }).click();
  await expect(
    page.getByText(/hace falta una clave de OpenRouter/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Añadir mi clave" }).click();
  await expect(
    page.getByText(/no pasan por ningún servidor de este sitio/),
  ).toBeVisible();
});

test("the assistant answers with a figure from a tool and shows the lookup", async ({
  page,
}) => {
  const replies = openRouterReplies("En Nuevo León es 24.6 % (INEGI, 2023).");
  const bodies: string[] = [];
  await page.route("https://openrouter.ai/api/v1/chat/completions", (route) => {
    bodies.push(route.request().postData() ?? "");
    route.fulfill({
      contentType: "text/event-stream",
      body: replies[bodies.length - 1] ?? replies[1],
    });
  });
  // A fake key: the request never leaves the browser, it is answered above.
  await page.addInitScript(() =>
    window.localStorage.setItem("geografia.openrouter-key", "sk-or-test"),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Preguntar" }).click();
  await page.getByLabel("Pregunta").fill("¿Cuánto es en Nuevo León?");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(
    page.getByText("Consultó Parte del valor agregado"),
  ).toBeVisible();
  await expect(page.getByText("En Nuevo León es 24.6 %")).toBeVisible();
  // The second request carries the tool's result, computed in the browser.
  expect(bodies[1]).toContain('\\"formatted\\":\\"24.6 %\\"');
});

test("the tour walks through its steps and keeps its place in the URL", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Recorrido" }).first().click();
  const tour = page.getByRole("region", { name: "Recorrido" });
  await expect(tour.getByText("Recorrido, paso 1 de")).toBeVisible();
  for (let i = 0; i < 3; i += 1)
    await tour.getByRole("button", { name: "Siguiente" }).click();
  await expect(page).toHaveURL(/[?&]paso=4/);
  await expect(page).toHaveURL(/[?&]t=19/);
  await expect(tour.getByText("Nuevo León", { exact: true })).toBeVisible();
  await page.reload();
  await expect(tour.getByText("Recorrido, paso 4 de")).toBeVisible();
});
