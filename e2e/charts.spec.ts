import { expect, test, type Page } from "@playwright/test";

const holdings = [
  {
    id: "gain",
    symbol: "APU",
    quantity: "100",
    averagePurchasePriceMnt: "100",
    purchaseFeesMnt: "0",
  },
  {
    id: "loss",
    symbol: "KHAN",
    quantity: "100",
    averagePurchasePriceMnt: "100",
    purchaseFeesMnt: "0",
  },
  {
    id: "flat",
    symbol: "GLMT",
    quantity: "10",
    averagePurchasePriceMnt: "100",
    purchaseFeesMnt: "0",
  },
  {
    id: "unknown",
    symbol: "UNKNOWN",
    quantity: "1",
    averagePurchasePriceMnt: "5000",
    purchaseFeesMnt: "0",
  },
];

async function loadPortfolio(
  page: Page,
  positions = holdings,
  closes = ["120", "80", "100"],
) {
  await page.addInitScript(
    (data) =>
      localStorage.setItem(
        "mse-equities.portfolio.v1",
        JSON.stringify({ schemaVersion: 1, holdings: data }),
      ),
    positions,
  );
  await page.route("**/market/latest.json", (route) =>
    route.fulfill({
      json: {
        schemaVersion: 1,
        collectedAt: "2026-10-30T10:00:00Z",
        source: "Test fixture",
        sourceUrl: "https://open.mse.mn/securities",
        instruments: positions.map((position, index) => ({
          sourceId: String(index),
          symbol: position.symbol,
          nameMn: position.symbol,
          tier: 1,
          status: "listed",
          profileUrl: "https://open.mse.mn/securities",
        })),
        quotes: closes.map((close, index) => ({
          sourceId: String(index),
          symbol: positions[index].symbol,
          date: "2026-10-29",
          close,
          previousClose: null,
          volume: 100,
        })),
        coverage: {
          listed: positions.length,
          priced: closes.length,
          failed: [],
        },
      },
    }),
  );
  await page.goto("/");
}

test("charts show gains, losses, break-even holdings, and exclude unpriced positions", async ({
  page,
}) => {
  await loadPortfolio(page);
  const charts = page.getByRole("region", { name: "Portfolio charts" });
  const gain = charts.getByRole("button", { name: "APU +₮2,000 20.00%" });
  const loss = charts.getByRole("button", { name: "KHAN −₮2,000 -20.00%" });
  await expect(gain).toBeVisible();
  await expect(loss).toBeVisible();
  const gainPlot = (await gain.locator(".gain-plot").boundingBox())!;
  const gainBar = (await gain.locator(".gain-bar").boundingBox())!;
  const lossPlot = (await loss.locator(".gain-plot").boundingBox())!;
  const lossBar = (await loss.locator(".gain-bar").boundingBox())!;
  expect(gainBar.x).toBeCloseTo(gainPlot.x + gainPlot.width / 2, 0);
  expect(lossBar.x + lossBar.width).toBeCloseTo(
    lossPlot.x + lossPlot.width / 2,
    0,
  );
  expect(gainBar.width).toBeCloseTo(lossBar.width, 0);
  await expect(
    charts.getByRole("button", { name: "GLMT +₮0 0.00%" }),
  ).toBeVisible();
  await expect(charts).toContainText("1 unpriced holding excluded");
  await expect(charts.getByRole("img")).toHaveAccessibleName(
    "Portfolio allocation by market value. APU 57.1%, KHAN 38.1%, GLMT 4.8%.",
  );
  await gain.click();
  await expect(page.getByRole("dialog")).toContainText("APU");
  await page.keyboard.press("Escape");
  await charts
    .getByRole("button", { name: "Cost & value", exact: true })
    .click();
  await expect(
    charts.getByRole("button", { name: "Cost & value", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    charts.getByRole("button", { name: "APU ₮12,000 Cost ₮10,000" }),
  ).toBeVisible();
  await expect(
    charts.getByRole("button", { name: "KHAN ₮8,000 Cost ₮10,000" }),
  ).toBeVisible();
  const costAndValue = charts.getByRole("button", {
    name: "APU ₮12,000 Cost ₮10,000",
  });
  expect(
    (await costAndValue.locator(".market-value-bar").boundingBox())!.width,
  ).toBeGreaterThan(
    (await costAndValue.locator(".cost-bar").boundingBox())!.width,
  );
  await expect(
    charts.getByRole("button", { name: "View KHAN, 38.1% of portfolio" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("mse-equities.portfolio.v1")!).holdings,
    ),
  ).toEqual(holdings);
});

test("all-unpriced holdings teach why charts are unavailable", async ({
  page,
}) => {
  await loadPortfolio(page, [holdings[3]], []);
  const charts = page.getByRole("region", { name: "Portfolio charts" });
  await expect(charts).toContainText(
    "Your charts will appear when verified prices are available",
  );
  await expect(charts.getByRole("img")).toHaveCount(0);
  await expect(charts.locator(".performance-row")).toHaveCount(0);
});

test("large portfolios aggregate the allocation tail and can expand all holding comparisons", async ({
  page,
}) => {
  const many = Array.from({ length: 9 }, (_, index) => ({
    ...holdings[0],
    id: `stock-${index}`,
    symbol: `STOCK${index}`,
  }));
  await loadPortfolio(
    page,
    many,
    many.map(() => "100"),
  );
  const charts = page.getByRole("region", { name: "Portfolio charts" });
  await expect(charts).toContainText("Other (4)");
  await expect(charts.getByRole("img")).toHaveAccessibleName(
    /Other \(4\) 44.4%/,
  );
  await charts.getByRole("button", { name: "Show all 9 holdings" }).click();
  await expect(
    charts.getByRole("button", { name: "STOCK8 +₮0 0.00%" }),
  ).toBeVisible();
  await charts.getByRole("button", { name: "Show largest 6 holdings" }).click();
  await expect(
    charts.getByRole("button", { name: "STOCK8 +₮0 0.00%" }),
  ).toHaveCount(0);
});

test("charts stay usable at narrow mobile widths", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await loadPortfolio(page);
  const charts = page.getByRole("region", { name: "Portfolio charts" });
  await charts
    .getByRole("button", { name: "Cost & value", exact: true })
    .click();
  await expect(
    charts.getByRole("button", { name: "APU ₮12,000 Cost ₮10,000" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await charts
    .getByRole("button", { name: "View APU, 57.1% of portfolio" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("APU");
});
