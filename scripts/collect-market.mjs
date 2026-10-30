import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import robotsParser from "robots-parser";
import {
  marketDate,
  parseDirectory,
  parseTradingHistory,
  SOURCE_NAME,
  SOURCE_ORIGIN,
  SOURCE_URL,
  validateSnapshot,
} from "./mse-source.mjs";

const USER_AGENT =
  "EquitiesMarketCollector/1.0 (+https://github.com; public MSE closing-price tracker)";
const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function readPrevious(filename, today) {
  try {
    return validateSnapshot(JSON.parse(await readFile(filename, "utf8")), {
      today,
    });
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(
      `Previous market snapshot cannot be validated: ${error.message}`,
    );
  }
}

async function atomicJson(filename, data) {
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporary, filename);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

function createSource({ fixtureDir, intervalMs, fetchImpl = fetch }) {
  let policy;
  let nextStart = 0;
  // Reserve request slots synchronously so concurrent workers still share one pace.
  async function pacedRequest(url) {
    const start = Math.max(Date.now(), nextStart);
    nextStart = start + intervalMs;
    await delay(Math.max(0, start - Date.now()));
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(30_000),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,text/plain;q=0.9",
        "Accept-Language": "mn,en;q=0.8",
      },
    });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status} from ${url}`);
      error.retryable = response.status === 429 || response.status >= 500;
      const retrySeconds = Number(response.headers.get("retry-after"));
      error.retryAfterMs = Number.isFinite(retrySeconds)
        ? Math.min(60_000, Math.max(0, retrySeconds * 1000))
        : 0;
      await response.body?.cancel();
      throw error;
    }
    return response.text();
  }

  async function request(url) {
    if (new URL(url).origin !== SOURCE_ORIGIN)
      throw new Error(`Refusing unexpected source origin: ${url}`);
    if (fixtureDir) {
      const pathname = new URL(url).pathname;
      const fragment = /^\/securities\/(\d+)\/tab\/tradeinfo$/u.exec(pathname);
      const filename =
        pathname === "/robots.txt"
          ? "robots.txt"
          : pathname === "/securities"
            ? "securities.html"
            : fragment
              ? `${fragment[1]}-trade.html`
              : null;
      if (!filename) throw new Error(`No fixture mapping for ${url}`);
      return readFile(path.join(fixtureDir, filename), "utf8");
    }
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await pacedRequest(url);
      } catch (error) {
        if (attempt >= 2 || error.retryable === false) throw error;
        await delay(Math.max(error.retryAfterMs || 0, 1000 * 2 ** attempt));
      }
    }
  }

  return {
    async initialize() {
      const robotsUrl = `${SOURCE_ORIGIN}/robots.txt`;
      policy = robotsParser(robotsUrl, await request(robotsUrl));
    },
    async get(url) {
      if (!policy || policy.isAllowed(url, USER_AGENT) !== true)
        throw new Error(`Robots policy does not allow ${url}`);
      return request(url);
    },
  };
}

/** Shared by the CLI and the offline integration tests. No files change until validation passes. */
export async function collectMarket({
  outputDir = path.resolve("public/market"),
  symbols = null,
  fixtureDir = null,
  intervalMs = 500,
  concurrency = 2,
  now = new Date(),
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  if (
    !Number.isFinite(intervalMs) ||
    intervalMs < 0 ||
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 2
  ) {
    throw new Error("Invalid request pacing or concurrency (maximum 2)");
  }
  const today = marketDate(now);
  const previous = await readPrevious(
    path.join(outputDir, "latest.json"),
    today,
  );
  const source = createSource({ fixtureDir, intervalMs, fetchImpl });
  await source.initialize();
  const instruments = parseDirectory(await source.get(SOURCE_URL));
  const listed = instruments.filter((row) => row.status === "listed");
  const oldListed =
    previous?.instruments.filter((row) => row.status === "listed").length || 0;
  if (oldListed && listed.length < oldListed * 0.9) {
    throw new Error(
      `Listed directory count fell from ${oldListed} to ${listed.length}; preserving the previous snapshot`,
    );
  }
  const selectedSymbols = symbols
    ? new Set(symbols.map((symbol) => symbol.toUpperCase()))
    : null;
  const selected = selectedSymbols
    ? listed.filter((row) => selectedSymbols.has(row.symbol.toUpperCase()))
    : listed;
  if (selectedSymbols && selected.length !== selectedSymbols.size) {
    const known = new Set(selected.map((row) => row.symbol.toUpperCase()));
    throw new Error(
      `Unknown listed symbols: ${[...selectedSymbols].filter((symbol) => !known.has(symbol)).join(", ")}`,
    );
  }
  if (!selected.length) throw new Error("No stocks selected");

  const currentIdentities = new Map(
    listed.map((instrument) => [instrument.sourceId, instrument.symbol]),
  );
  const quotes = new Map(
    (previous?.quotes || [])
      .filter((quote) => currentIdentities.get(quote.sourceId) === quote.symbol)
      .map((quote) => [quote.sourceId, quote]),
  );
  const histories = new Map();
  const failures = [];
  let cursor = 0;
  let completed = 0;
  let successfulHistories = 0;
  let regressed = 0;
  log(
    `Collecting ${selected.length} of ${listed.length} listed stocks from MSE`,
  );
  async function worker() {
    while (cursor < selected.length) {
      const instrument = selected[cursor++];
      try {
        const url = `${instrument.profileUrl}/tab/tradeinfo`;
        const history = parseTradingHistory(await source.get(url), instrument, {
          today,
        });
        const latest = history.at(-1);
        const old = quotes.get(instrument.sourceId);
        if (latest && old && latest.date < old.date) {
          regressed += 1;
          throw new Error(
            `Latest source date regressed from ${old.date} to ${latest.date}`,
          );
        }
        if (latest) {
          quotes.set(instrument.sourceId, latest);
          histories.set(
            instrument.sourceId,
            history.slice(-400).map(({ date, close }) => ({ date, close })),
          );
          successfulHistories += 1;
        } else {
          // An empty source history does not establish a new price. Retain a prior dated quote, if one exists.
          log(`${instrument.symbol}: no regular equity closing-price history`);
        }
      } catch (error) {
        failures.push(instrument.symbol);
        log(
          `${instrument.symbol}: ${error.message}; retaining any previously validated quote`,
        );
      }
      completed += 1;
      if (completed % 10 === 0 || completed === selected.length)
        log(`Checked ${completed}/${selected.length} stocks`);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, selected.length) }, worker),
  );
  if (failures.length / selected.length > 0.2) {
    throw new Error(
      `${failures.length}/${selected.length} quote requests failed; preserving the previous snapshot`,
    );
  }
  if (!selectedSymbols && quotes.size / listed.length < 0.5) {
    throw new Error(
      `Only ${quotes.size}/${listed.length} listed stocks have validated prices; preserving the previous snapshot`,
    );
  }
  if (regressed > 0 && successfulHistories === 0)
    throw new Error(
      "All returned quote dates regressed; preserving the previous snapshot",
    );
  const failed = new Set(failures);
  if (selectedSymbols) {
    for (const symbol of previous?.coverage.failed || [])
      if (!selectedSymbols.has(symbol.toUpperCase())) failed.add(symbol);
  }
  const snapshot = validateSnapshot(
    {
      schemaVersion: 1,
      collectedAt: now.toISOString(),
      source: SOURCE_NAME,
      sourceUrl: SOURCE_URL,
      instruments,
      quotes: [...quotes.values()].sort((a, b) =>
        a.symbol.localeCompare(b.symbol),
      ),
      coverage: {
        listed: listed.length,
        priced: quotes.size,
        failed: [...failed].sort(),
      },
    },
    { today },
  );
  for (const [sourceId, history] of histories)
    await atomicJson(
      path.join(outputDir, "history", `${sourceId}.json`),
      history,
    );
  await atomicJson(path.join(outputDir, "latest.json"), snapshot);
  log(
    `Saved ${snapshot.coverage.priced}/${listed.length} priced stocks; ${failed.size} failed requests`,
  );
  return snapshot;
}

function cliOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help") return null;
    if (
      !["--symbols", "--output", "--fixture-dir", "--interval-ms"].includes(
        argument,
      ) ||
      !args[index + 1]
    ) {
      throw new Error(`Unknown or incomplete option: ${argument}`);
    }
    const value = args[++index];
    if (argument === "--symbols")
      options.symbols = value
        .split(",")
        .map((symbol) => symbol.trim())
        .filter(Boolean);
    if (argument === "--output") options.outputDir = path.resolve(value);
    if (argument === "--fixture-dir") options.fixtureDir = path.resolve(value);
    if (argument === "--interval-ms") options.intervalMs = Number(value);
  }
  return options;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const options = cliOptions(process.argv.slice(2));
    if (options) await collectMarket(options);
    else
      console.log(
        "Usage: node scripts/collect-market.mjs [--symbols APU,KHAN] [--output public/market] [--fixture-dir DIRECTORY] [--interval-ms 500]",
      );
  } catch (error) {
    console.error(`Market collection failed: ${error.message}`);
    process.exitCode = 1;
  }
}
