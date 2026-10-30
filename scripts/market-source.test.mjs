import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { collectMarket } from "./collect-market.mjs";
import {
  marketDate,
  parseDirectory,
  parseTradingHistory,
  SOURCE_NAME,
  SOURCE_URL,
} from "./mse-source.mjs";

const instrument = { sourceId: "90", symbol: "APU" };
const row = (overrides = {}) => ({
  companycode: 90,
  Symbol: "90-O-0000",
  securityType: "CS",
  MDSubOrderBookType: "Regular",
  dates: "2026-10-29",
  ClosingPrice: 1056,
  PreviousClose: 1086,
  Volume: 92277,
  ...overrides,
});
const historyHtml = (rows) =>
  `<div id="chart-data" data-trading-histories="${JSON.stringify(rows).replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"></div>`;
const directoryHtml = (
  entries = [
    ["class1", "90", "APU"],
    ["class2", "563", "KHAN"],
    ["class3", "567", "TDB"],
    ["delisted", "1", "OLD"],
  ],
) =>
  `<div id="stocks">${["class1", "class2", "class3", "delisted"]
    .map(
      (section) =>
        `<div id="${section}"><table><tr><th>№</th><th>Symbol</th><th>Name</th></tr>${entries
          .filter(([id]) => id === section)
          .map(
            ([, sourceId, symbol]) =>
              `<tr><td>1</td><td><a href="https://open.mse.mn/securities/${sourceId}">${symbol}</a></td><td><a href="https://open.mse.mn/securities/${sourceId}">Компанийн нэр ${symbol}</a></td></tr>`,
          )
          .join("")}</table></div>`,
    )
    .join(
      "",
    )}</div><div id="bonds"><a href="/securities/999">NOT A STOCK</a></div>`;
const today = "2026-10-30";
const now = new Date("2026-10-30T09:00:00Z");

test("directory parser discovers only explicit stock tiers and delisted records", () => {
  const records = parseDirectory(directoryHtml());
  assert.equal(records.length, 4);
  assert.deepEqual(
    records.map(({ symbol, tier, status }) => ({ symbol, tier, status })),
    [
      { symbol: "APU", tier: 1, status: "listed" },
      { symbol: "KHAN", tier: 2, status: "listed" },
      { symbol: "TDB", tier: 3, status: "listed" },
      { symbol: "OLD", tier: null, status: "delisted" },
    ],
  );
  assert.equal(records[0].nameMn, "Компанийн нэр APU");
});

test("directory parser fails closed for missing tiers, duplicate identity, and off-origin links", () => {
  assert.throws(
    () =>
      parseDirectory(directoryHtml().replace('id="class2"', 'id="missing"')),
    /section class2/u,
  );
  assert.throws(
    () =>
      parseDirectory(
        directoryHtml([
          ["class1", "90", "APU"],
          ["class2", "90", "KHAN"],
          ["class3", "567", "TDB"],
          ["delisted", "1", "OLD"],
        ]),
      ),
    /Duplicate source ID/u,
  );
  assert.throws(
    () =>
      parseDirectory(
        directoryHtml([
          ["class1", "90", "APU"],
          ["class2", "563", "APU"],
          ["class3", "567", "TDB"],
          ["delisted", "1", "OLD"],
        ]),
      ),
    /Duplicate listed symbol/u,
  );
  assert.throws(
    () =>
      parseDirectory(
        directoryHtml().replaceAll(
          "https://open.mse.mn/securities/90",
          "https://example.com/securities/90",
        ),
      ),
    /Unexpected stock profile URL/u,
  );
});

test("history selects session dates chronologically, preserves decimal text, and deduplicates equivalent rows", () => {
  const rows = parseTradingHistory(
    historyHtml([
      row(),
      row({
        dates: "2026-10-28",
        ClosingPrice: "1086.10",
        MDEntryTime: "2026-10-30 12:00:00",
      }),
      row({ ClosingPrice: "1056.00", PreviousClose: "1086", Volume: "92277" }),
      row({ dates: "2026-10-30", securityType: "BOND", ClosingPrice: 999 }),
    ]),
    instrument,
    { today },
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].date, "2026-10-28");
  assert.equal(rows[0].close, "1086.1");
  assert.deepEqual(rows[1], {
    sourceId: "90",
    symbol: "APU",
    date: "2026-10-29",
    close: "1056",
    previousClose: "1086",
    volume: 92277,
  });
});

test("history rejects conflicts, wrong instruments, missing dates, invalid prices, and future sessions", () => {
  assert.throws(
    () =>
      parseTradingHistory(
        historyHtml([row(), row({ ClosingPrice: 999 })]),
        instrument,
        { today },
      ),
    /conflicting history/u,
  );
  assert.throws(
    () =>
      parseTradingHistory(
        historyHtml([row({ companycode: 563 })]),
        instrument,
        { today },
      ),
    /wrong source ID/u,
  );
  for (const dates of [undefined, "2026-02-30", "2026-10-31", "30/10/2026"]) {
    assert.throws(
      () =>
        parseTradingHistory(historyHtml([row({ dates })]), instrument, {
          today,
        }),
      /session date/u,
    );
  }
  for (const ClosingPrice of [0, -1, "", "NaN", "Infinity", null]) {
    assert.throws(
      () =>
        parseTradingHistory(historyHtml([row({ ClosingPrice })]), instrument, {
          today,
        }),
      /ClosingPrice/u,
    );
  }
  assert.throws(
    () =>
      parseTradingHistory(historyHtml([row({ Volume: -1 })]), instrument, {
        today,
      }),
    /invalid volume/u,
  );
  assert.throws(
    () => parseTradingHistory("<div></div>", instrument, { today }),
    /history element/u,
  );
  assert.throws(
    () =>
      parseTradingHistory(
        '<div id="chart-data" data-trading-histories="broken"></div>',
        instrument,
        { today },
      ),
    /invalid trading history JSON/u,
  );
});

test("an empty history remains unpriced and unknown previous close remains null", () => {
  assert.deepEqual(
    parseTradingHistory(historyHtml([]), instrument, { today }),
    [],
  );
  assert.equal(
    parseTradingHistory(historyHtml([row({ PreviousClose: 0 })]), instrument, {
      today,
    })[0].previousClose,
    null,
  );
});

test("market date uses the exchange timezone across UTC midnight boundaries", () => {
  assert.equal(marketDate(new Date("2026-10-29T17:00:00Z")), "2026-10-30");
});

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "equities-market-test-"));
  const fixtureDir = path.join(root, "source");
  const outputDir = path.join(root, "market");
  await mkdir(fixtureDir);
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    path.join(fixtureDir, "robots.txt"),
    "User-agent: *\nDisallow:\n",
  );
  await writeFile(path.join(fixtureDir, "securities.html"), directoryHtml());
  for (const sourceId of ["90", "563", "567"]) {
    await writeFile(
      path.join(fixtureDir, `${sourceId}-trade.html`),
      historyHtml([row({ companycode: Number(sourceId) })]),
    );
  }
  return { fixtureDir, outputDir, now, log() {} };
}

test("offline collector writes real source dates and a compact dated history", async (t) => {
  const options = await fixture(t);
  const result = await collectMarket(options);
  assert.deepEqual(result.coverage, { listed: 3, priced: 3, failed: [] });
  assert.equal(result.collectedAt, now.toISOString());
  assert.equal(result.quotes[0].date, "2026-10-29");
  assert.equal(result.source, SOURCE_NAME);
  assert.equal(result.sourceUrl, SOURCE_URL);
  assert.deepEqual(
    JSON.parse(
      await readFile(path.join(options.outputDir, "history/90.json"), "utf8"),
    ),
    [{ date: "2026-10-29", close: "1056" }],
  );
});

test("failed requests, malformed directory, and low coverage leave the last good snapshot untouched", async (t) => {
  const options = await fixture(t);
  await collectMarket(options);
  const filename = path.join(options.outputDir, "latest.json");
  const before = await readFile(filename, "utf8");
  await writeFile(
    path.join(options.fixtureDir, "90-trade.html"),
    "source temporarily unavailable",
  );
  await assert.rejects(collectMarket(options), /quote requests failed/u);
  assert.equal(await readFile(filename, "utf8"), before);
  await writeFile(
    path.join(options.fixtureDir, "securities.html"),
    "<div>source unavailable</div>",
  );
  await assert.rejects(collectMarket(options), /Stock directory container/u);
  assert.equal(await readFile(filename, "utf8"), before);

  const empty = await fixture(t);
  for (const sourceId of ["90", "563", "567"])
    await writeFile(
      path.join(empty.fixtureDir, `${sourceId}-trade.html`),
      historyHtml([]),
    );
  await assert.rejects(collectMarket(empty), /Only 0\/3/u);
  await assert.rejects(
    readFile(path.join(empty.outputDir, "latest.json")),
    /ENOENT/u,
  );
});

test("bounded symbol updates merge existing prices without inventing a fresh session date", async (t) => {
  const options = await fixture(t);
  await collectMarket(options);
  await writeFile(
    path.join(options.fixtureDir, "90-trade.html"),
    historyHtml([row({ ClosingPrice: "1059.25" })]),
  );
  const result = await collectMarket({
    ...options,
    symbols: ["apu"],
    now: new Date("2026-10-31T09:00:00Z"),
  });
  assert.equal(result.quotes.length, 3);
  assert.equal(
    result.quotes.find((quote) => quote.symbol === "APU").close,
    "1059.25",
  );
  assert.equal(
    result.quotes.find((quote) => quote.symbol === "KHAN").date,
    "2026-10-29",
  );
  await assert.rejects(
    collectMarket({ ...options, symbols: ["UNKNOWN"] }),
    /Unknown listed symbols/u,
  );
});

test("an isolated source failure carries the original dated quote and marks partial coverage", async (t) => {
  const options = await fixture(t);
  await writeFile(
    path.join(options.fixtureDir, "securities.html"),
    directoryHtml([
      ["class1", "90", "APU"],
      ["class1", "601", "ONE"],
      ["class2", "563", "KHAN"],
      ["class3", "567", "TDB"],
      ["class3", "602", "TWO"],
      ["delisted", "1", "OLD"],
    ]),
  );
  for (const sourceId of ["601", "602"]) {
    await writeFile(
      path.join(options.fixtureDir, `${sourceId}-trade.html`),
      historyHtml([row({ companycode: Number(sourceId) })]),
    );
  }
  await collectMarket(options);
  await writeFile(
    path.join(options.fixtureDir, "90-trade.html"),
    "temporarily unavailable",
  );
  const result = await collectMarket({
    ...options,
    now: new Date("2026-10-31T09:00:00Z"),
  });
  assert.deepEqual(result.coverage, { listed: 5, priced: 5, failed: ["APU"] });
  assert.equal(
    result.quotes.find((quote) => quote.symbol === "APU").date,
    "2026-10-29",
  );
});

test("saved chart history is limited to the most recent 400 validated sessions", async (t) => {
  const options = await fixture(t);
  const sessions = Array.from({ length: 500 }, (_, index) => {
    const session = new Date("2024-01-01T00:00:00Z");
    session.setUTCDate(session.getUTCDate() + index);
    return row({ dates: session.toISOString().slice(0, 10) });
  });
  await writeFile(
    path.join(options.fixtureDir, "90-trade.html"),
    historyHtml(sessions),
  );
  await collectMarket({ ...options, symbols: ["APU"] });
  const saved = JSON.parse(
    await readFile(path.join(options.outputDir, "history/90.json"), "utf8"),
  );
  assert.equal(saved.length, 400);
  assert.equal(saved[0].date, sessions[100].dates);
  assert.equal(saved.at(-1).date, sessions.at(-1).dates);
});

test("robots disallow prevents source collection before any market snapshot is written", async (t) => {
  const options = await fixture(t);
  await writeFile(
    path.join(options.fixtureDir, "robots.txt"),
    "User-agent: *\nDisallow: /securities\n",
  );
  await assert.rejects(collectMarket(options), /Robots policy/u);
  await assert.rejects(
    readFile(path.join(options.outputDir, "latest.json")),
    /ENOENT/u,
  );
});

test("regressing source dates and unexpected directory shrinkage preserve previous data", async (t) => {
  const options = await fixture(t);
  await collectMarket(options);
  const filename = path.join(options.outputDir, "latest.json");
  const before = await readFile(filename, "utf8");
  for (const sourceId of ["90", "563", "567"]) {
    await writeFile(
      path.join(options.fixtureDir, `${sourceId}-trade.html`),
      historyHtml([
        row({ companycode: Number(sourceId), dates: "2026-10-28" }),
      ]),
    );
  }
  await assert.rejects(
    collectMarket(options),
    /preserving the previous snapshot/u,
  );
  assert.equal(await readFile(filename, "utf8"), before);
  const expanded = JSON.parse(before);
  expanded.instruments.push({
    ...expanded.instruments[0],
    sourceId: "600",
    symbol: "EXTRA",
  });
  expanded.coverage.listed = 4;
  await writeFile(filename, JSON.stringify(expanded));
  await assert.rejects(collectMarket(options), /directory count fell/u);
});
