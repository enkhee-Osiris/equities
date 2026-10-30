import { expect, test } from "@playwright/test";

const fixture = {
  schemaVersion: 1,
  holdings: [
    {
      id: "test-apu",
      symbol: "APU",
      quantity: "100",
      averagePurchasePriceMnt: "1000",
      purchaseFeesMnt: "100",
    },
  ],
};

test("add, persist, edit, and remove a holding", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Market directory 160" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add your first holding" }).click();
  await page.getByLabel("Stock symbol", { exact: true }).fill("APU");
  await page.getByLabel("Number of shares", { exact: true }).fill("100");
  await page
    .getByLabel("Average purchase price", { exact: false })
    .fill("1000");
  await page.getByLabel("Total purchase fees", { exact: false }).fill("100");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add holding", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Portfolio totals" }),
  ).toContainText("₮100,100");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Details for APU" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Details for APU" }).click();
  await page.getByRole("button", { name: "Edit holding", exact: true }).click();
  await page.getByLabel("Number of shares", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("region", { name: "Portfolio totals" }),
  ).toContainText("₮200,100");
  await page.getByRole("button", { name: "Details for APU" }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Yes, remove holding" }).click();
  await expect(
    page.getByRole("heading", { name: "Every portfolio starts" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("import preview, cancellation, JSON export, and rejected import preserve holdings", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Import portfolio file").setInputFiles({
    name: "portfolio.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await expect(page.getByRole("dialog")).toContainText("100 shares");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Every portfolio starts" }),
  ).toBeVisible();
  await page.getByLabel("Import portfolio file").setInputFiles({
    name: "portfolio.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.getByRole("button", { name: "Replace portfolio" }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "JSON backup" }).click();
  const file = await downloaded;
  const stream = await file.createReadStream();
  let content = "";
  for await (const chunk of stream!) content += chunk.toString();
  expect(JSON.parse(content)).toEqual(fixture);
  await page.getByLabel("Import portfolio file").setInputFiles({
    name: "invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("bad,columns\nno,data"),
  });
  await expect(page.getByRole("alert")).toContainText("Import failed");
  await expect(
    page.getByRole("button", { name: "Details for APU" }),
  ).toBeVisible();
});

test("example is labeled, browser local, and works at mobile width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore an example" }).click();
  await expect(
    page.getByText("Illustrative holdings. Real MSE prices."),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("mse-equities.portfolio.v1"),
    ),
  ).toBeNull();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Details for APU" }).click();
  await expect(page.getByRole("dialog")).toContainText("Closing price");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to my portfolio" }).click();
  await expect(
    page.getByRole("heading", { name: "Every portfolio starts" }),
  ).toBeVisible();
});

test("unpriced holdings show partial gain instead of a fabricated loss", async ({
  page,
}) => {
  await page.addInitScript(
    (data) =>
      localStorage.setItem("mse-equities.portfolio.v1", JSON.stringify(data)),
    {
      ...fixture,
      holdings: [
        ...fixture.holdings,
        {
          id: "unknown",
          symbol: "UNKNOWN",
          quantity: "10",
          averagePurchasePriceMnt: "5000",
          purchaseFeesMnt: "0",
        },
      ],
    },
  );
  await page.goto("/");
  await expect(page.getByText("1 of 2 holdings priced")).toBeVisible();
  await expect(
    page.getByText("Partial valuation · excludes unpriced holdings"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Details for UNKNOWN" }),
  ).toBeVisible();
});

test("editing the example stays labeled and never replaces a saved personal portfolio", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore an example" }).click();
  await page.evaluate(
    (data) =>
      localStorage.setItem("mse-equities.portfolio.v1", JSON.stringify(data)),
    fixture,
  );
  await page.getByRole("button", { name: "Details for APU" }).click();
  await page.getByRole("button", { name: "Edit holding", exact: true }).click();
  await page.getByLabel("Number of shares", { exact: true }).fill("3000");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Changes stay in this example.", { exact: false }),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("mse-equities.portfolio.v1")!),
  );
  expect(stored).toEqual(fixture);
});
