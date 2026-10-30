import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  calculatePortfolio,
  exportPortfolioCsv,
  exportPortfolioJson,
  formatMoney,
  formatPercent,
  parsePortfolioFile,
  validateHoldings,
  type Holding,
  type Quote,
} from "./portfolio";

const holding = (overrides: Partial<Holding> = {}): Holding => ({
  id: "holding-apu",
  symbol: "APU",
  quantity: "100",
  averagePurchasePriceMnt: "1000",
  purchaseFeesMnt: "100",
  ...overrides,
});

const quote = (overrides: Partial<Quote> = {}): Quote => ({
  sourceId: "90",
  symbol: "APU",
  date: "2026-10-30",
  close: "1200",
  previousClose: "1190",
  volume: 100,
  ...overrides,
});

describe("invalid market prices", () => {
  it("keeps a zero closing price unpriced rather than showing a complete loss", () => {
    const result = calculatePortfolio([holding()], [quote({ close: "0" })]);
    expect(result.unpricedCount).toBe(1);
    expect(result.positions[0].gain).toBeNull();
    expect(result.pricedCost.toString()).toBe("0");
  });
});

describe("calculatePortfolio", () => {
  it("includes purchase fees in cost once and calculates exact unrealized gain", () => {
    const result = calculatePortfolio([holding()], [quote()]);
    expect(result.cost.toFixed()).toBe("100100");
    expect(result.value.toFixed()).toBe("120000");
    expect(result.gain.toFixed()).toBe("19900");
    expect(result.returnPct?.toFixed(6)).toBe("19.880120");
    expect(result.positions[0].gain?.toFixed()).toBe("19900");
  });

  it("weights total return by purchase cost instead of averaging percentages", () => {
    const result = calculatePortfolio(
      [
        holding({
          quantity: "1",
          averagePurchasePriceMnt: "100",
          purchaseFeesMnt: "0",
        }),
        holding({
          id: "holding-gov",
          symbol: "GOV",
          quantity: "1",
          averagePurchasePriceMnt: "900",
          purchaseFeesMnt: "0",
        }),
      ],
      [quote({ close: "200" }), quote({ symbol: "GOV", close: "810" })],
    );
    expect(result.gain.toFixed()).toBe("10");
    expect(result.returnPct?.toFixed()).toBe("1");
  });

  it("keeps unknown values null and compares partial value with only priced costs", () => {
    const result = calculatePortfolio(
      [
        holding(),
        holding({
          id: "missing",
          symbol: "UNKNOWN",
          quantity: "2",
          averagePurchasePriceMnt: "5000",
        }),
      ],
      [quote()],
    );
    expect(result.cost.toFixed()).toBe("110200");
    expect(result.pricedCost.toFixed()).toBe("100100");
    expect(result.value.toFixed()).toBe("120000");
    expect(result.gain.toFixed()).toBe("19900");
    expect(result.unpricedCount).toBe(1);
    expect(result.positions[1]).toMatchObject({
      quote: null,
      value: null,
      gain: null,
      returnPct: null,
    });
  });

  it("handles zero cost without dividing by zero", () => {
    const result = calculatePortfolio(
      [holding({ averagePurchasePriceMnt: "0", purchaseFeesMnt: "0" })],
      [quote()],
    );
    expect(result.gain.toFixed()).toBe("120000");
    expect(result.returnPct).toBeNull();
    expect(result.positions[0].returnPct).toBeNull();
  });

  it("retains decimal precision and large amounts", () => {
    const result = calculatePortfolio(
      [
        holding({
          quantity: "0.1",
          averagePurchasePriceMnt: "0.2",
          purchaseFeesMnt: "0.001",
        }),
      ],
      [quote({ close: "0.3" })],
    );
    expect(result.cost.toFixed()).toBe("0.021");
    expect(result.value.toFixed()).toBe("0.03");
    expect(result.gain.toFixed()).toBe("0.009");
    const large = calculatePortfolio(
      [
        holding({
          quantity: "999999999999.999999999999999999",
          averagePurchasePriceMnt: "999999999999999.999999999999999999",
          purchaseFeesMnt: "0.000000000000000001",
        }),
      ],
      [],
    );
    expect(large.cost.toFixed()).toBe(
      "999999999999999999999999999.998999000000000001000000000000000001",
    );
  });

  it("chooses the latest valid quote regardless of order", () => {
    const result = calculatePortfolio(
      [holding()],
      [
        quote(),
        quote({ date: "2026-10-29", close: "1000" }),
        quote({ date: "2026-11-01", close: "NaN" }),
      ],
    );
    expect(result.positions[0].quote?.date).toBe("2026-10-30");
    expect(result.value.toFixed()).toBe("120000");
  });

  it("returns an empty portfolio without a fictional percentage", () => {
    const result = calculatePortfolio([], []);
    expect(result.value.isZero()).toBe(true);
    expect(result.returnPct).toBeNull();
    expect(result.positions).toEqual([]);
  });
});

describe("portfolio import and export", () => {
  it("round trips versioned JSON and CSV without losing precision or identifiers", () => {
    const holdings = [
      holding({ quantity: "0.123456789012345678" }),
      holding({
        id: "second",
        symbol: "MSE-A.1",
        quantity: "2.5",
        purchaseFeesMnt: "0",
      }),
    ];
    expect(
      parsePortfolioFile(exportPortfolioJson(holdings), "holdings.json"),
    ).toEqual(holdings);
    expect(
      parsePortfolioFile(exportPortfolioCsv(holdings), "holdings.csv"),
    ).toEqual(holdings);
  });

  it("accepts BOM, quoted fields, CRLF and surrounding whitespace", () => {
    const csv =
      '\uFEFFsymbol,quantity,averagePurchasePriceMnt,purchaseFeesMnt\r\n" apu "," 12.50 "," 1000.00 "," 2.50 "\r\n\r\n';
    const result = parsePortfolioFile(csv, "IMPORT.CSV");
    expect(result[0]).toMatchObject({
      symbol: "APU",
      quantity: "12.5",
      averagePurchasePriceMnt: "1000",
      purchaseFeesMnt: "2.5",
    });
    expect(result[0].id).toBeTruthy();
  });

  it("normalizes numeric JSON fields and preserves unknown tickers", () => {
    const document = JSON.stringify({
      schemaVersion: 1,
      holdings: [
        { symbol: " xyz ", quantity: 2, averagePurchasePriceMnt: 10.5 },
      ],
    });
    expect(parsePortfolioFile(document, "portfolio.json")[0]).toMatchObject({
      symbol: "XYZ",
      quantity: "2",
      averagePurchasePriceMnt: "10.5",
      purchaseFeesMnt: "0",
    });
  });

  it("does not modify caller input", () => {
    const original = Object.freeze({
      ...holding(),
      symbol: " apu ",
      quantity: "00100.00",
    });
    const result = validateHoldings(Object.freeze([original]));
    expect(original.symbol).toBe(" apu ");
    expect(original.quantity).toBe("00100.00");
    expect(result[0]).toMatchObject({ symbol: "APU", quantity: "100" });
    expect(result[0]).not.toBe(original);
  });

  it.each([
    "0",
    "-1",
    "Infinity",
    "NaN",
    "1e3",
    "1,000",
    "+1",
    ".5",
    "1.",
    "1000000000001",
    "0.1234567890123456789",
  ])("rejects invalid quantity %s", (quantity) => {
    expect(() => validateHoldings([holding({ quantity })])).toThrow();
  });

  it.each(["-1", "1000000000000001", "Infinity", "1e5"])(
    "rejects invalid price or fees %s",
    (amount) => {
      expect(() =>
        validateHoldings([holding({ averagePurchasePriceMnt: amount })]),
      ).toThrow();
      expect(() =>
        validateHoldings([holding({ purchaseFeesMnt: amount })]),
      ).toThrow();
    },
  );

  it("rejects duplicate symbols after normalization and duplicate ids", () => {
    expect(() =>
      validateHoldings([holding(), holding({ id: "second", symbol: " apu " })]),
    ).toThrow(/Duplicate stock symbol/);
    expect(() =>
      validateHoldings([holding(), holding({ symbol: "GOV" })]),
    ).toThrow(/identifier/);
  });

  it.each(["=SUM(A1)", "+APU", "@APU", "-APU", "APU\tBAD", "АПУ", ""])(
    "rejects invalid or spreadsheet-formula symbol %s",
    (symbol) => {
      expect(() => validateHoldings([holding({ symbol })])).toThrow();
    },
  );

  it("rejects unsupported JSON versions, shapes and unusual object prototypes", () => {
    expect(() =>
      parsePortfolioFile('{"schemaVersion":2,"holdings":[]}', "portfolio.json"),
    ).toThrow(/schemaVersion 1/);
    expect(() => parsePortfolioFile("[]", "portfolio.json")).toThrow();
    expect(() =>
      parsePortfolioFile('{"schemaVersion":1,"holdings":{}}', "portfolio.json"),
    ).toThrow(/array/);
    expect(() =>
      validateHoldings([
        Object.assign(Object.create({ symbol: "APU" }), holding()),
      ]),
    ).toThrow(/object/);
    expect(() =>
      validateHoldings([
        JSON.parse(
          '{"__proto__":{},"symbol":"APU","quantity":"1","averagePurchasePriceMnt":"1"}',
        ),
      ]),
    ).toThrow(/unsupported/);
  });

  it("rejects malformed CSV, mismatched rows, duplicate columns and comma-formatted amounts", () => {
    expect(() =>
      parsePortfolioFile(
        'symbol,quantity,averagePurchasePriceMnt,purchaseFeesMnt\nAPU,"1,000",100,0',
        "a.csv",
      ),
    ).toThrow(/plain decimals/);
    expect(() =>
      parsePortfolioFile(
        "symbol,quantity,averagePurchasePriceMnt,purchaseFeesMnt\nAPU,1,100",
        "a.csv",
      ),
    ).toThrow(/number of fields/);
    expect(() =>
      parsePortfolioFile(
        "symbol,quantity,averagePurchasePriceMnt,purchaseFeesMnt,symbol",
        "a.csv",
      ),
    ).toThrow(/duplicate/);
    expect(() =>
      parsePortfolioFile(
        'symbol,quantity,averagePurchasePriceMnt,purchaseFeesMnt\nAPU,"1,100,0',
        "a.csv",
      ),
    ).toThrow(/Invalid CSV/);
  });

  it("rejects excessive portfolio and file sizes", () => {
    expect(() =>
      validateHoldings(
        Array.from({ length: 1001 }, (_, index) =>
          holding({ id: `h${index}`, symbol: `S${index}` }),
        ),
      ),
    ).toThrow(/at most 1000/);
    expect(() => parsePortfolioFile(" ".repeat(2_000_001), "a.json")).toThrow(
      /too large/,
    );
  });
});

describe("formatting", () => {
  it("formats full MNT amounts without converting large decimals to floating point", () => {
    expect(formatMoney("1234567.50")).toBe("₮1,234,567.5");
    expect(formatMoney("-123.456")).toBe("−₮123.46");
    expect(formatMoney("999999999999999999999999999.99")).toBe(
      "₮999,999,999,999,999,999,999,999,999.99",
    );
    expect(formatMoney("-0.001")).toBe("₮0");
  });

  it("formats percentages and unavailable returns", () => {
    expect(formatPercent(new Decimal("19.88011988"))).toBe("19.88%");
    expect(formatPercent(new Decimal("-0.001"))).toBe("0.00%");
    expect(formatPercent(null)).toBe("—");
  });
});
