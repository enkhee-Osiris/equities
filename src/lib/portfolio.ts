import Decimal from "decimal.js";
import Papa from "papaparse";

export interface Holding {
  id: string;
  symbol: string;
  quantity: string;
  averagePurchasePriceMnt: string;
  purchaseFeesMnt: string;
}

export interface Quote {
  sourceId: string;
  symbol: string;
  date: string;
  close: string;
  previousClose: string | null;
  volume: number;
}

export interface Instrument {
  sourceId: string;
  symbol: string;
  nameMn: string;
  tier: number | null;
  status: "listed" | "delisted";
  profileUrl: string;
}

export interface MarketData {
  schemaVersion: 1;
  collectedAt: string;
  source: string;
  sourceUrl: string;
  instruments: Instrument[];
  quotes: Quote[];
  coverage: { listed: number; priced: number; failed: string[] };
}

export interface Position {
  holding: Holding;
  quote: Quote | null;
  cost: Decimal;
  value: Decimal | null;
  gain: Decimal | null;
  returnPct: Decimal | null;
}

export interface Portfolio {
  positions: Position[];
  cost: Decimal;
  pricedCost: Decimal;
  value: Decimal;
  gain: Decimal;
  returnPct: Decimal | null;
  unpricedCount: number;
}

const Amount = Decimal.clone({
  precision: 80,
  rounding: Decimal.ROUND_HALF_UP,
});
const MAX_HOLDINGS = 1_000;
const MAX_FILE_LENGTH = 2_000_000;
const DECIMAL_PATTERN = /^\d+(?:\.\d{1,18})?$/;
const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.-]{0,19}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const CSV_COLUMNS = [
  "id",
  "symbol",
  "quantity",
  "averagePurchasePriceMnt",
  "purchaseFeesMnt",
];
const REQUIRED_CSV_COLUMNS = CSV_COLUMNS.slice(1);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parseAmount(
  value: unknown,
  field: string,
  limit: string,
  positive = false,
): string {
  let normalized: string;
  if (typeof value === "number" && Number.isFinite(value)) {
    normalized = new Amount(value).toFixed();
  } else if (typeof value === "string") {
    normalized = value.trim();
  } else {
    throw new Error(`${field} must be a decimal number.`);
  }

  if (normalized.length > 100 || !DECIMAL_PATTERN.test(normalized)) {
    throw new Error(
      `${field} must use plain decimals, with up to 18 decimal places.`,
    );
  }

  const amount = new Amount(normalized);
  if ((positive && amount.isZero()) || amount.greaterThan(limit)) {
    throw new Error(
      `${field} must be ${positive ? "greater than zero" : "zero or greater"} and no more than ${limit}.`,
    );
  }
  return amount.toFixed();
}

export function validateHoldings(input: unknown): Holding[] {
  if (!Array.isArray(input)) throw new Error("Holdings must be an array.");
  if (input.length > MAX_HOLDINGS)
    throw new Error(
      `A portfolio can contain at most ${MAX_HOLDINGS} holdings.`,
    );

  const symbols = new Set<string>();
  const ids = new Set<string>();
  return input.map((item, index) => {
    const row = `Holding ${index + 1}`;
    if (!isRecord(item)) throw new Error(`${row} must be an object.`);
    if (Object.keys(item).some((key) => !CSV_COLUMNS.includes(key))) {
      throw new Error(`${row} contains an unsupported field.`);
    }
    if (typeof item.symbol !== "string")
      throw new Error(`${row} needs a stock symbol.`);
    const symbol = item.symbol.trim().toUpperCase();
    if (!SYMBOL_PATTERN.test(symbol))
      throw new Error(`${row} has an invalid stock symbol.`);
    if (symbols.has(symbol))
      throw new Error(
        `Duplicate stock symbol: ${symbol}. Combine its purchases into one holding.`,
      );
    symbols.add(symbol);

    const id =
      item.id === undefined || item.id === "" ? crypto.randomUUID() : item.id;
    if (typeof id !== "string" || !ID_PATTERN.test(id))
      throw new Error(`${row} has an invalid identifier.`);
    if (ids.has(id)) throw new Error(`${row} repeats a holding identifier.`);
    ids.add(id);

    return {
      id,
      symbol,
      quantity: parseAmount(
        item.quantity,
        `${row} quantity`,
        "1000000000000",
        true,
      ),
      averagePurchasePriceMnt: parseAmount(
        item.averagePurchasePriceMnt,
        `${row} purchase price`,
        "1000000000000000",
      ),
      purchaseFeesMnt: parseAmount(
        item.purchaseFeesMnt ?? "0",
        `${row} purchase fees`,
        "1000000000000000",
      ),
    };
  });
}

export function parsePortfolioFile(text: string, filename: string): Holding[] {
  if (text.length > MAX_FILE_LENGTH)
    throw new Error("The portfolio file is too large (maximum 2 MB).");
  const contents = text.replace(/^\uFEFF/, "").trim();
  if (!contents) throw new Error("The portfolio file is empty.");

  if (/\.json$/i.test(filename)) {
    let document: unknown;
    try {
      document = JSON.parse(contents);
    } catch {
      throw new Error("The file does not contain valid JSON.");
    }
    if (!isRecord(document) || document.schemaVersion !== 1) {
      throw new Error("Use a portfolio JSON file with schemaVersion 1.");
    }
    return validateHoldings(document.holdings);
  }

  if (!/\.csv$/i.test(filename))
    throw new Error("Choose a .json or .csv portfolio file.");
  const parsed = Papa.parse<string[]>(contents, { skipEmptyLines: "greedy" });
  if (parsed.errors.length)
    throw new Error(`Invalid CSV: ${parsed.errors[0].message}`);
  const [header = [], ...rows] = parsed.data;
  const columns = header.map((column) => column.trim());
  if (new Set(columns).size !== columns.length)
    throw new Error("The CSV has duplicate column names.");
  if (columns.some((column) => !CSV_COLUMNS.includes(column)))
    throw new Error("The CSV contains an unsupported column.");
  if (REQUIRED_CSV_COLUMNS.some((column) => !columns.includes(column))) {
    throw new Error(
      `CSV columns must include ${REQUIRED_CSV_COLUMNS.join(", ")}.`,
    );
  }
  if (rows.length > MAX_HOLDINGS)
    throw new Error(
      `A portfolio can contain at most ${MAX_HOLDINGS} holdings.`,
    );
  return validateHoldings(
    rows.map((row, index) => {
      if (row.length !== columns.length)
        throw new Error(`CSV row ${index + 2} has the wrong number of fields.`);
      return Object.fromEntries(
        columns.map((column, columnIndex) => [column, row[columnIndex].trim()]),
      );
    }),
  );
}

export function exportPortfolioJson(holdings: Holding[]): string {
  return `${JSON.stringify({ schemaVersion: 1, holdings: validateHoldings(holdings) }, null, 2)}\n`;
}

export function exportPortfolioCsv(holdings: Holding[]): string {
  const validated = validateHoldings(holdings);
  const data = validated.map((holding) =>
    CSV_COLUMNS.map((column) => holding[column as keyof Holding]),
  );
  return `${Papa.unparse({ fields: CSV_COLUMNS, data }, { newline: "\n" })}\n`;
}

function usableClose(quote: Quote): boolean {
  if (
    typeof quote.close !== "string" ||
    quote.close.length > 100 ||
    !DECIMAL_PATTERN.test(quote.close)
  )
    return false;
  const close = new Amount(quote.close);
  return (
    close.isPositive() &&
    !close.isZero() &&
    close.lessThanOrEqualTo("1000000000000000")
  );
}

export function calculatePortfolio(
  holdings: Holding[],
  quotes: Quote[],
): Portfolio {
  const quotesBySymbol = new Map<string, Quote>();
  for (const quote of quotes) {
    if (!usableClose(quote)) continue;
    const symbol = quote.symbol.trim().toUpperCase();
    const previous = quotesBySymbol.get(symbol);
    if (!previous || quote.date > previous.date)
      quotesBySymbol.set(symbol, quote);
  }

  let cost = new Amount(0);
  let pricedCost = new Amount(0);
  let value = new Amount(0);
  let unpricedCount = 0;
  const positions = holdings.map((holding): Position => {
    const positionCost = new Amount(holding.quantity)
      .times(holding.averagePurchasePriceMnt)
      .plus(holding.purchaseFeesMnt);
    cost = cost.plus(positionCost);
    const quote =
      quotesBySymbol.get(holding.symbol.trim().toUpperCase()) ?? null;
    if (!quote) {
      unpricedCount += 1;
      return {
        holding,
        quote,
        cost: positionCost,
        value: null,
        gain: null,
        returnPct: null,
      };
    }
    const positionValue = new Amount(holding.quantity).times(quote.close);
    const gain = positionValue.minus(positionCost);
    pricedCost = pricedCost.plus(positionCost);
    value = value.plus(positionValue);
    return {
      holding,
      quote,
      cost: positionCost,
      value: positionValue,
      gain,
      returnPct: positionCost.isZero()
        ? null
        : gain.dividedBy(positionCost).times(100),
    };
  });
  const gain = value.minus(pricedCost);
  return {
    positions,
    cost,
    pricedCost,
    value,
    gain,
    returnPct: pricedCost.isZero()
      ? null
      : gain.dividedBy(pricedCost).times(100),
    unpricedCount,
  };
}

export function formatMoney(
  value: Decimal | string | number,
  decimals = 2,
): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18)
    throw new Error("Money decimal places must be between 0 and 18.");
  const amount = new Amount(value).toDecimalPlaces(decimals);
  const [integer, fraction] = amount.abs().toFixed(decimals).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const trimmedFraction = fraction?.replace(/0+$/, "");
  return `${amount.isNegative() && !amount.isZero() ? "−" : ""}₮${grouped}${trimmedFraction ? `.${trimmedFraction}` : ""}`;
}

export function formatPercent(value: Decimal | null): string {
  if (value === null) return "—";
  const rounded = new Amount(value).toDecimalPlaces(2);
  return `${rounded.isZero() ? "0.00" : rounded.toFixed(2)}%`;
}
