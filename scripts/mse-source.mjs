import { load } from "cheerio";
import Decimal from "decimal.js";

export const SOURCE_URL = "https://open.mse.mn/securities";
export const SOURCE_NAME = "Mongolian Stock Exchange";
export const SOURCE_ORIGIN = new URL(SOURCE_URL).origin;

const sections = [
  ["class1", 1],
  ["class2", 2],
  ["class3", 3],
  ["delisted", null],
];

const cleanText = (text) => text.replace(/\s+/gu, " ").trim();

export function marketDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function validDate(value, latest = marketDate()) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value <= latest
  );
}

function positivePrice(value, label) {
  if (
    !["number", "string"].includes(typeof value) ||
    String(value).trim() === ""
  ) {
    throw new Error(`${label} is missing`);
  }
  let price;
  try {
    price = new Decimal(value);
  } catch {
    throw new Error(`${label} is invalid`);
  }
  if (!price.isFinite() || !price.isPositive() || price.isZero())
    throw new Error(`${label} must be positive`);
  return price.toFixed();
}

function previousPrice(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === 0 ||
    value === "0"
  )
    return null;
  return positivePrice(value, "PreviousClose");
}

/** Only the stock tables are authoritative for discovery; bonds/funds share this page. */
export function parseDirectory(html) {
  const $ = load(html);
  if ($("#stocks").length !== 1)
    throw new Error("Stock directory container is missing or duplicated");
  const instruments = [];
  for (const [id, tier] of sections) {
    const section = $(`#stocks #${id}`);
    if (section.length !== 1)
      throw new Error(`Stock directory section ${id} is missing or duplicated`);
    let count = 0;
    section.find("table tr").each((_, row) => {
      const cells = $(row).children("td");
      if (!cells.length) return;
      if (cells.length !== 3)
        throw new Error(`Unexpected stock directory columns in ${id}`);
      const symbolLink = cells.eq(1).find("a");
      const nameLink = cells.eq(2).find("a");
      if (symbolLink.length !== 1 || nameLink.length !== 1)
        throw new Error(`Missing stock links in ${id}`);
      const href = symbolLink.attr("href");
      const nameHref = nameLink.attr("href");
      if (!href || !nameHref)
        throw new Error(`Empty stock profile URL in ${id}`);
      const profile = new URL(href, SOURCE_URL);
      if (profile.href !== new URL(nameHref, SOURCE_URL).href)
        throw new Error("Ticker and company profile links differ");
      const match = /^\/securities\/(\d+)$/u.exec(profile.pathname);
      if (
        profile.origin !== SOURCE_ORIGIN ||
        !match ||
        profile.search ||
        profile.hash
      ) {
        throw new Error(`Unexpected stock profile URL: ${profile.href}`);
      }
      const symbol = cleanText(symbolLink.text());
      const nameMn = cleanText(nameLink.text());
      if (!symbol || !nameMn) throw new Error(`Empty stock identity in ${id}`);
      instruments.push({
        sourceId: match[1],
        symbol,
        nameMn,
        tier,
        status: tier === null ? "delisted" : "listed",
        profileUrl: profile.href,
      });
      count += 1;
    });
    if (!count) throw new Error(`Stock directory section ${id} is empty`);
  }
  const ids = new Set();
  const listedSymbols = new Set();
  for (const instrument of instruments) {
    if (ids.has(instrument.sourceId))
      throw new Error(`Duplicate source ID: ${instrument.sourceId}`);
    ids.add(instrument.sourceId);
    if (instrument.status === "listed") {
      if (listedSymbols.has(instrument.symbol))
        throw new Error(`Duplicate listed symbol: ${instrument.symbol}`);
      listedSymbols.add(instrument.symbol);
    }
  }
  return instruments;
}

/** `dates` is the exchange session date. MDEntryTime can disagree and is not substituted. */
export function parseTradingHistory(
  html,
  instrument,
  { today = marketDate() } = {},
) {
  const $ = load(html);
  const chart = $("#chart-data");
  if (chart.length !== 1)
    throw new Error(
      `${instrument.symbol}: trading history element is missing or duplicated`,
    );
  const attribute = chart.attr("data-trading-histories");
  if (!attribute)
    throw new Error(
      `${instrument.symbol}: trading history attribute is missing`,
    );
  let rows;
  try {
    rows = JSON.parse(attribute);
  } catch {
    throw new Error(`${instrument.symbol}: invalid trading history JSON`);
  }
  if (!Array.isArray(rows))
    throw new Error(`${instrument.symbol}: trading history is not an array`);
  const sessions = new Map();
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row))
      throw new Error(`${instrument.symbol}: malformed history row`);
    if (String(row.companycode) !== instrument.sourceId)
      throw new Error(`${instrument.symbol}: history has the wrong source ID`);
    if (row.securityType !== "CS" || row.MDSubOrderBookType !== "Regular")
      continue;
    if (!validDate(row.dates, today))
      throw new Error(
        `${instrument.symbol}: invalid or future session date: ${row.dates}`,
      );
    const volume =
      typeof row.Volume === "string" && /^\d+$/u.test(row.Volume)
        ? Number(row.Volume)
        : row.Volume;
    if (!Number.isSafeInteger(volume) || volume < 0)
      throw new Error(`${instrument.symbol}: invalid volume on ${row.dates}`);
    const quote = {
      sourceId: instrument.sourceId,
      symbol: instrument.symbol,
      date: row.dates,
      close: positivePrice(
        row.ClosingPrice,
        `${instrument.symbol} ClosingPrice on ${row.dates}`,
      ),
      previousClose: previousPrice(row.PreviousClose),
      volume,
    };
    const previous = sessions.get(quote.date);
    if (previous && JSON.stringify(previous) !== JSON.stringify(quote)) {
      throw new Error(
        `${instrument.symbol}: conflicting history rows on ${quote.date}`,
      );
    }
    sessions.set(quote.date, quote);
  }
  return [...sessions.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function validateSnapshot(snapshot, { today = marketDate() } = {}) {
  if (
    snapshot?.schemaVersion !== 1 ||
    snapshot.source !== SOURCE_NAME ||
    snapshot.sourceUrl !== SOURCE_URL ||
    !Number.isFinite(Date.parse(snapshot.collectedAt)) ||
    !Array.isArray(snapshot.instruments) ||
    !Array.isArray(snapshot.quotes)
  ) {
    throw new Error("Invalid market snapshot metadata");
  }
  const instruments = new Map(
    snapshot.instruments
      .filter((row) => row.status === "listed")
      .map((row) => [row.sourceId, row]),
  );
  const quotes = new Set();
  for (const quote of snapshot.quotes) {
    const instrument = instruments.get(quote.sourceId);
    if (
      !instrument ||
      quote.symbol !== instrument.symbol ||
      quotes.has(quote.sourceId) ||
      !validDate(quote.date, today) ||
      positivePrice(quote.close, "Snapshot close") !== quote.close ||
      previousPrice(quote.previousClose) !== quote.previousClose ||
      !Number.isSafeInteger(quote.volume) ||
      quote.volume < 0
    )
      throw new Error("Invalid market snapshot quote");
    quotes.add(quote.sourceId);
  }
  if (
    snapshot.coverage?.listed !== instruments.size ||
    snapshot.coverage.priced !== quotes.size ||
    !Array.isArray(snapshot.coverage.failed) ||
    snapshot.coverage.failed.some((symbol) => typeof symbol !== "string")
  ) {
    throw new Error("Invalid market coverage");
  }
  return snapshot;
}
