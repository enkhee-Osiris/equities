import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  ArrowUpDown,
  Check,
  ChevronDown,
  CircleHelp,
  FileUp,
  Layers3,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import Decimal from "decimal.js";
import {
  calculatePortfolio,
  exportPortfolioCsv,
  exportPortfolioJson,
  formatMoney,
  formatPercent,
  parsePortfolioFile,
  type Holding,
  type MarketData,
} from "./lib/portfolio";

import {
  HoldingForm,
  PositionDetails,
  Sheet,
} from "./components/PortfolioPanels";
import {
  ageDays,
  dateLabel,
  errorMessage,
  quantity,
  signed,
  tone,
} from "./lib/presentation";

const STORAGE_KEY = "mse-equities.portfolio.v1";
const BASE = import.meta.env.BASE_URL;
const colors = [
  "#316c5b",
  "#7b94b8",
  "#a5b9ae",
  "#a8a0bd",
  "#d4b786",
  "#7ba9ab",
];
const exampleHoldings: Holding[] = [
  ["APU", "2000", "1000", "20000"],
  ["KHAN", "1000", "1700", "17000"],
  ["GLMT", "1500", "1100", "16500"],
  ["MNDL", "10000", "83", "8300"],
  ["SUU", "2000", "590", "11800"],
  ["MSE", "3000", "300", "9000"],
].map(([symbol, quantity, averagePurchasePriceMnt, purchaseFeesMnt]) => ({
  id: `example-${symbol}`,
  symbol,
  quantity,
  averagePurchasePriceMnt,
  purchaseFeesMnt,
}));

function readSaved() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    return {
      holdings: raw ? parsePortfolioFile(raw, "portfolio.json") : [],
      error: "",
      raw,
    };
  } catch {
    return {
      holdings: [],
      error:
        "Saved holdings could not be read. Import a backup or start a new portfolio.",
      raw,
    };
  }
}

function download(contents: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [saved] = useState(readSaved);
  const [personal, setPersonal] = useState<Holding[]>(saved.holdings);
  const [example, setExample] = useState(false);
  const [examplePositions, setExamplePositions] = useState(exampleHoldings);
  const [storageError, setStorageError] = useState(saved.error);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketError, setMarketError] = useState("");
  const [view, setView] = useState<"holdings" | "market">("holdings");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<{
    key: "symbol" | "value" | "gain";
    ascending: boolean;
  }>({ key: "value", ascending: false });
  const [editor, setEditor] = useState<Holding | string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [imported, setImported] = useState<Holding[] | null>(null);
  const [importError, setImportError] = useState("");
  const [toast, setToast] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [directoryLimit, setDirectoryLimit] = useState(30);
  const fileInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const holdings = example ? examplePositions : personal;
  const portfolio = useMemo(
    () => calculatePortfolio(holdings, market?.quotes || []),
    [holdings, market],
  );
  const instruments = market?.instruments || [];
  const names = useMemo(
    () => new Map(instruments.map((i) => [i.symbol, i])),
    [instruments],
  );
  const quoteMap = useMemo(
    () => new Map(market?.quotes.map((q) => [q.symbol, q]) || []),
    [market],
  );
  const dates = market?.quotes.map((q) => q.date).sort() || [];
  const latestDate = dates.at(-1);
  const hasHoldings = holdings.length > 0;
  const olderHoldings = portfolio.positions.filter(
    (p) => p.quote && ageDays(p.quote.date) > 7,
  );
  const visiblePositions = portfolio.positions
    .filter(
      (p) =>
        `${p.holding.symbol} ${names.get(p.holding.symbol)?.nameMn || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (filter === "all" ||
          (filter === "gainers" ? p.gain?.isPositive() : p.gain?.isNegative())),
    )
    .sort((a, b) => {
      const cmp =
        sort.key === "symbol"
          ? a.holding.symbol.localeCompare(b.holding.symbol)
          : (a[sort.key] || new Decimal("-1e40")).cmp(
              b[sort.key] || new Decimal("-1e40"),
            );
      return sort.ascending ? cmp : -cmp;
    });
  const directory = instruments.filter(
    (i) =>
      i.status === "listed" &&
      `${i.symbol} ${i.nameMn}`.toLowerCase().includes(search.toLowerCase()),
  );
  const selectedPosition = portfolio.positions.find(
    (p) => p.holding.id === selected,
  );
  const allocations = [...portfolio.positions]
    .filter((p) => p.value?.isPositive())
    .sort((a, b) => b.value!.cmp(a.value!));

  async function loadMarket() {
    setLoading(true);
    setMarketError("");
    try {
      const response = await fetch(`${BASE}market/latest.json`, {
        cache: "no-cache",
      });
      if (!response.ok)
        throw new Error(
          "Market prices are unavailable. Try again in a moment.",
        );
      const data = await response.json();
      if (
        data.schemaVersion !== 1 ||
        !Array.isArray(data.instruments) ||
        !Array.isArray(data.quotes) ||
        !data.coverage
      )
        throw new Error(
          "The market data could not be read. Please try again later.",
        );
      setMarket(data);
    } catch (error) {
      setMarketError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void loadMarket();
  }, []);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement) &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        searchInput.current?.focus();
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!exportOpen) return;
    const listener = () => setExportOpen(false);
    document.addEventListener("click", listener);
    return () => document.removeEventListener("click", listener);
  }, [exportOpen]);

  function savePersonal(next: Holding[], message: string) {
    setPersonal(next);
    setExample(false);
    try {
      localStorage.setItem(STORAGE_KEY, exportPortfolioJson(next));
      setStorageError("");
    } catch {
      setStorageError(
        "Your browser could not save these changes. Export a JSON backup before closing this page.",
      );
    }
    setToast(message);
  }
  function commit(next: Holding[], message: string) {
    if (example) {
      setExamplePositions(next);
      setToast("Example updated. Your personal portfolio has not changed.");
      return;
    }
    savePersonal(next, message);
  }
  function saveHolding(holding: Holding) {
    const existing = holdings.some((h) => h.id === holding.id);
    commit(
      existing
        ? holdings.map((h) => (h.id === holding.id ? holding : h))
        : [...holdings, holding],
      `${holding.symbol} ${existing ? "updated" : "added"} to your portfolio`,
    );
    setEditor(null);
  }
  function exportFile(kind: "json" | "csv") {
    download(
      kind === "json"
        ? exportPortfolioJson(holdings)
        : exportPortfolioCsv(holdings),
      `equities-${example ? "example-" : ""}portfolio.${kind}`,
      kind === "json" ? "application/json" : "text/csv;charset=utf-8",
    );
    setExportOpen(false);
    setToast(`${kind.toUpperCase()} portfolio exported`);
  }
  async function importFile(file?: File) {
    if (!file) return;
    setImportError("");
    try {
      if (file.size > 2_000_000)
        throw new Error("Choose a portfolio file smaller than 2 MB.");
      setImported(parsePortfolioFile(await file.text(), file.name));
    } catch (error) {
      setImportError(errorMessage(error));
    }
    if (fileInput.current) fileInput.current.value = "";
  }
  function changeSort(key: typeof sort.key) {
    setSort({
      key,
      ascending: sort.key === key ? !sort.ascending : key === "symbol",
    });
  }
  function changeView(next: typeof view) {
    setView(next);
    setSearch("");
    setFilter("all");
  }

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to portfolio
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href={BASE} aria-label="Equities home">
            <span className="brand-symbol">
              <span />
              <span />
              <span />
            </span>
            Equities
            <span className="brand-description">MSE portfolio tracker</span>
          </a>
          <div className="header-right">
            <span className="local-indicator">
              <span />
              Browser local
            </span>
            <button
              className="icon-button"
              onClick={() => setHelp(true)}
              aria-label="About this portfolio tracker"
            >
              <CircleHelp size={18} />
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="page-shell">
        <section className="page-heading">
          <div>
            <h1>
              Your portfolio<span className="heading-dot">.</span>
            </h1>
            <p>Your Mongolian stocks, in perspective.</p>
          </div>
          <div className="page-actions">
            <button
              className="button"
              onClick={() => fileInput.current?.click()}
            >
              <FileUp size={16} />
              Import
            </button>
            <div className="export-control">
              <button
                className="button"
                aria-expanded={exportOpen}
                aria-haspopup="menu"
                disabled={!hasHoldings}
                onClick={(e) => {
                  e.stopPropagation();
                  setExportOpen(!exportOpen);
                }}
              >
                <ArrowDownToLine size={16} />
                Export
                <ChevronDown size={13} />
              </button>
              {exportOpen && (
                <div className="dropdown" role="menu">
                  <button role="menuitem" onClick={() => exportFile("json")}>
                    JSON backup<span>Restore your complete portfolio</span>
                  </button>
                  <button role="menuitem" onClick={() => exportFile("csv")}>
                    CSV spreadsheet<span>Open in Excel or Numbers</span>
                  </button>
                </div>
              )}
            </div>
            <button className="button primary" onClick={() => setEditor("")}>
              <Plus size={17} />
              Add holding
            </button>
          </div>
        </section>
        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          aria-label="Import portfolio file"
          accept=".csv,.json"
          onChange={(e) => void importFile(e.target.files?.[0])}
        />
        {storageError && (
          <div className="notice warning" role="alert">
            <span>{storageError}</span>
            <button
              onClick={() =>
                saved.error && saved.raw
                  ? download(
                      saved.raw,
                      "equities-recovery.json",
                      "application/json",
                    )
                  : savePersonal(personal, "Portfolio saved")
              }
            >
              {saved.error && saved.raw
                ? "Download saved backup"
                : "Try saving again"}
            </button>
          </div>
        )}
        {importError && (
          <div className="notice warning" role="alert">
            <span>Import failed: {importError}</span>
            <button
              onClick={() => setImportError("")}
              aria-label="Dismiss import error"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {marketError && (
          <div className="notice warning" role="alert">
            <span>{marketError} Your holdings stay on this device.</span>
            <button onClick={() => void loadMarket()}>Try again</button>
          </div>
        )}
        {example && (
          <div className="example-banner">
            <span>
              <Layers3 size={16} />
              <strong>Example portfolio</strong>
              <span>
                Illustrative holdings. Real MSE prices. Changes stay in this
                example.
              </span>
            </span>
            <button
              onClick={() => {
                setExample(false);
                setSelected(null);
              }}
            >
              Back to my portfolio <ArrowRight size={14} />
            </button>
          </div>
        )}
        <div className="portfolio-meta">
          <span className="portfolio-name">
            <span className="portfolio-marker" />
            {example ? "Example holdings" : "Personal portfolio"}
            <span className="count-label">{holdings.length} holdings</span>
          </span>
          <div className="data-date">
            <span
              className={`status-dot ${latestDate && ageDays(latestDate) > 4 ? "old" : ""}`}
            />
            {loading
              ? "Loading closing prices…"
              : latestDate
                ? `Latest market close · ${dateLabel(latestDate, true)}`
                : "Closing prices unavailable"}
            <button
              className={`icon-button small ${loading ? "spinning" : ""}`}
              aria-label="Reload published market prices"
              title="Reload published prices"
              onClick={() => void loadMarket()}
              disabled={loading}
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
        <section className="summary" aria-label="Portfolio totals">
          <div>
            <span className="metric-label">
              Total purchase cost{" "}
              <span title="Shares × average purchase price + purchase fees">
                <CircleHelp size={13} />
              </span>
            </span>
            <strong>{formatMoney(portfolio.cost, 0)}</strong>
            <span className="metric-note">
              Capital invested, including purchase fees
            </span>
          </div>
          <div>
            <span className="metric-label">Market value</span>
            <strong>
              {hasHoldings && portfolio.unpricedCount === holdings.length
                ? "—"
                : formatMoney(portfolio.value, 0)}
            </strong>
            <span className="metric-note">
              {portfolio.unpricedCount
                ? `${holdings.length - portfolio.unpricedCount} of ${holdings.length} holdings priced`
                : "Based on latest available closing prices"}
            </span>
          </div>
          <div className="gain-metric">
            <span className="metric-label">Unrealized gain / loss</span>
            <strong className={tone(portfolio.gain)}>
              {hasHoldings && portfolio.unpricedCount === holdings.length
                ? "—"
                : signed(portfolio.gain)}
              <span className={`return-badge ${tone(portfolio.gain)}`}>
                {portfolio.returnPct?.isPositive() ? (
                  <ArrowUpRight size={14} />
                ) : portfolio.returnPct?.isNegative() ? (
                  <ArrowDownLeft size={14} />
                ) : null}
                {formatPercent(portfolio.returnPct)}
              </span>
            </strong>
            <span className="metric-note">
              {portfolio.unpricedCount
                ? "Partial valuation · excludes unpriced holdings"
                : "Your return on current holdings"}
            </span>
          </div>
        </section>
        {hasHoldings && portfolio.unpricedCount > 0 && (
          <div className="coverage-note">
            <CircleHelp size={14} />
            {portfolio.unpricedCount} holding
            {portfolio.unpricedCount > 1 ? "s have" : " has"} no verified price.
            Their purchase cost is excluded from gain/loss.
          </div>
        )}
        {olderHoldings.length > 0 && (
          <div className="coverage-note">
            <CircleHelp size={14} />
            {olderHoldings.length} holding
            {olderHoldings.length > 1 ? "s use" : " uses"} a price older than 7
            days. Review the price dates before relying on this valuation.
          </div>
        )}
        <section className="ledger">
          <div className="ledger-navigation">
            <nav aria-label="Portfolio views">
              <button
                className={view === "holdings" ? "active" : ""}
                onClick={() => changeView("holdings")}
              >
                Holdings<span>{holdings.length}</span>
              </button>
              <button
                className={view === "market" ? "active" : ""}
                onClick={() => changeView("market")}
              >
                Market directory
                <span>
                  {instruments.filter((i) => i.status === "listed").length ||
                    "—"}
                </span>
              </button>
            </nav>
            <span className="currency-label">All amounts in MNT</span>
          </div>
          <div className="table-toolbar">
            <label className="search-field">
              <Search size={16} />
              <input
                ref={searchInput}
                aria-label={
                  view === "holdings"
                    ? "Search your holdings"
                    : "Search market directory"
                }
                placeholder={
                  view === "holdings"
                    ? "Search holdings…"
                    : "Search symbols or companies…"
                }
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setDirectoryLimit(30);
                }}
              />
              <kbd>/</kbd>
            </label>
            {view === "holdings" ? (
              <div className="filters" aria-label="Filter holdings">
                {[
                  ["all", "All holdings"],
                  ["gainers", "Gainers"],
                  ["losers", "Losers"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={filter === value}
                    className={filter === value ? "selected" : ""}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="directory-count">
                {directory.length} listed companies
              </span>
            )}
          </div>
          {view === "holdings" ? (
            <>
              <div className="table-scroll">
                <table className="holdings-table">
                  <caption className="visually-hidden">
                    Current holdings valued at latest available MSE closing
                    prices
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">
                        <button onClick={() => changeSort("symbol")}>
                          Company <ArrowUpDown size={12} />
                        </button>
                      </th>
                      <th scope="col" className="optional">
                        Shares
                      </th>
                      <th scope="col" className="optional">
                        Avg. buy price
                      </th>
                      <th scope="col">Latest close</th>
                      <th scope="col">
                        <button onClick={() => changeSort("value")}>
                          Market value <ArrowUpDown size={12} />
                        </button>
                      </th>
                      <th scope="col">
                        <button onClick={() => changeSort("gain")}>
                          Gain / loss <ArrowUpDown size={12} />
                        </button>
                      </th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePositions.map((position, index) => {
                      const {
                        holding: h,
                        quote,
                        value,
                        gain,
                        returnPct,
                      } = position;
                      return (
                        <tr key={h.id}>
                          <th scope="row">
                            <button
                              className="company-cell"
                              onClick={() => setSelected(h.id)}
                            >
                              <span
                                className="stock-mark"
                                style={
                                  {
                                    "--stock-color":
                                      colors[index % colors.length],
                                  } as React.CSSProperties
                                }
                              >
                                {h.symbol.slice(0, 2)}
                              </span>
                              <span>
                                <strong>{h.symbol}</strong>
                                <span>
                                  {names.get(h.symbol)?.nameMn ||
                                    "Not in the current directory"}
                                </span>
                              </span>
                            </button>
                          </th>
                          <td className="optional">{quantity(h.quantity)}</td>
                          <td className="optional">
                            {formatMoney(h.averagePurchasePriceMnt)}
                          </td>
                          <td>
                            {quote ? (
                              <>
                                <span>{formatMoney(quote.close)}</span>
                                <span
                                  className={`cell-sub ${ageDays(quote.date) > 7 ? "old-price" : ""}`}
                                >
                                  {dateLabel(
                                    quote.date,
                                    ageDays(quote.date) > 365,
                                  )}
                                </span>
                              </>
                            ) : (
                              <span className="muted">No price</span>
                            )}
                          </td>
                          <td className="value-cell">
                            {value ? formatMoney(value, 0) : "—"}
                            {quote && (
                              <span
                                className={`cell-sub mobile-only ${ageDays(quote.date) > 7 ? "old-price" : ""}`}
                              >
                                {dateLabel(
                                  quote.date,
                                  ageDays(quote.date) > 365,
                                )}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={tone(gain)}>{signed(gain)}</span>
                            <span className={`cell-sub ${tone(gain)}`}>
                              {formatPercent(returnPct)}
                            </span>
                          </td>
                          <td>
                            <button
                              className="icon-button row-more"
                              aria-label={`Details for ${h.symbol}`}
                              onClick={() => setSelected(h.id)}
                            >
                              <MoreHorizontal size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {hasHoldings && (
                    <tfoot>
                      <tr>
                        <th scope="row">
                          {portfolio.unpricedCount
                            ? "Priced subtotal"
                            : "Portfolio total"}
                          <span>
                            {holdings.length - portfolio.unpricedCount} priced
                            holdings
                          </span>
                        </th>
                        <td className="optional" />
                        <td className="optional" />
                        <td />
                        <td>
                          {portfolio.unpricedCount === holdings.length
                            ? "—"
                            : formatMoney(portfolio.value, 0)}
                        </td>
                        <td className={tone(portfolio.gain)}>
                          {portfolio.unpricedCount === holdings.length
                            ? "—"
                            : signed(portfolio.gain)}
                          <span className="cell-sub">
                            {formatPercent(portfolio.returnPct)}
                          </span>
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              {!hasHoldings ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Layers3 size={27} strokeWidth={1.4} />
                  </div>
                  <h2>Every portfolio starts with a first holding.</h2>
                  <p>
                    Add your stocks or import a portfolio to see where you
                    stand.
                  </p>
                  <div>
                    <button
                      className="button primary"
                      onClick={() => setEditor("")}
                    >
                      <Plus size={16} />
                      Add your first holding
                    </button>
                    <button
                      className="button"
                      onClick={() => {
                        setExample(true);
                        setSearch("");
                        setFilter("all");
                      }}
                    >
                      Explore an example <ArrowRight size={15} />
                    </button>
                  </div>
                  <button
                    className="template-link"
                    onClick={() =>
                      download(
                        "symbol,quantity,averagePurchasePriceMnt,purchaseFeesMnt\nAPU,100,1000,100\n",
                        "equities-template.csv",
                        "text/csv",
                      )
                    }
                  >
                    Download a CSV template
                  </button>
                </div>
              ) : visiblePositions.length === 0 ? (
                <div className="empty-search">
                  <Search size={22} />
                  <p>No holdings match this view.</p>
                  <button
                    className="text-link"
                    onClick={() => {
                      setSearch("");
                      setFilter("all");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="table-scroll">
                <table className="directory-table">
                  <thead>
                    <tr>
                      <th scope="col">Company</th>
                      <th scope="col">Tier</th>
                      <th scope="col">Latest dated close</th>
                      <th scope="col">Price date</th>
                      <th scope="col">
                        <span className="visually-hidden">Add holding</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {directory.slice(0, directoryLimit).map((i, index) => {
                      const q = quoteMap.get(i.symbol);
                      return (
                        <tr key={i.sourceId}>
                          <th scope="row">
                            <a
                              className="company-cell"
                              href={i.profileUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <span
                                className="stock-mark"
                                style={
                                  {
                                    "--stock-color":
                                      colors[index % colors.length],
                                  } as React.CSSProperties
                                }
                              >
                                {i.symbol.slice(0, 2)}
                              </span>
                              <span>
                                <strong>{i.symbol}</strong>
                                <span>{i.nameMn}</span>
                              </span>
                            </a>
                          </th>
                          <td>
                            <span className="tier-badge">
                              {["", "I", "II", "III"][i.tier || 0] || "—"}
                            </span>
                          </td>
                          <td>{q ? formatMoney(q.close) : "Unavailable"}</td>
                          <td className="muted">
                            {q ? dateLabel(q.date, true) : "—"}
                          </td>
                          <td>
                            <button
                              className="button add-stock"
                              onClick={() => {
                                const existing = holdings.find(
                                  (h) => h.symbol === i.symbol,
                                );
                                setEditor(existing || i.symbol);
                              }}
                            >
                              <Plus size={14} />
                              <span>
                                {holdings.some((h) => h.symbol === i.symbol)
                                  ? "Edit"
                                  : "Add"}
                              </span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {directory.length > directoryLimit && (
                <button
                  className="load-more button"
                  onClick={() => setDirectoryLimit((n) => n + 30)}
                >
                  Show more companies <ChevronDown size={14} />
                </button>
              )}
              {directory.length === 0 && (
                <div className="empty-search">
                  <p>
                    {loading
                      ? "Loading the MSE directory…"
                      : "No companies match your search."}
                  </p>
                </div>
              )}
              <p className="directory-disclaimer">
                Listed status does not confirm that a stock is currently
                trading. Directory coverage is being reconciled with MSE’s
                issuer totals.
              </p>
            </>
          )}
          <div className="ledger-footer">
            <span>
              <ShieldCheck size={14} />
              Your holdings stay in your browser.
            </span>
            <button onClick={() => setHelp(true)}>
              How your return is calculated <ArrowUpRight size={13} />
            </button>
          </div>
        </section>
        {hasHoldings && view === "holdings" && (
          <section className="portfolio-context">
            <div className="allocation">
              <div className="subheading">
                <h2>Portfolio mix</h2>
                <span>By market value</span>
              </div>
              {allocations.length ? (
                <>
                  <div
                    className="allocation-bar"
                    role="img"
                    aria-label="Portfolio allocation by market value"
                  >
                    {allocations.map((p, i) => (
                      <button
                        key={p.holding.id}
                        style={{
                          width: `${p.value!.div(portfolio.value).mul(100).toNumber()}%`,
                          background: colors[i % colors.length],
                        }}
                        title={`${p.holding.symbol}: ${p.value!.div(portfolio.value).mul(100).toFixed(1)}%`}
                        aria-label={`View ${p.holding.symbol}`}
                        onClick={() => setSelected(p.holding.id)}
                      />
                    ))}
                  </div>
                  <div className="allocation-legend">
                    {allocations.map((p, i) => (
                      <button
                        key={p.holding.id}
                        onClick={() => setSelected(p.holding.id)}
                      >
                        <span
                          className="legend-dot"
                          style={{ background: colors[i % colors.length] }}
                        />
                        <strong>{p.holding.symbol}</strong>
                        <span>
                          {p.value!.div(portfolio.value).mul(100).toFixed(1)}%
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="muted">
                  Add priced holdings to see your allocation.
                </p>
              )}
            </div>
            <div className="numbers-note">
              <CircleHelp size={19} />
              <div>
                <h2>A note on your numbers</h2>
                <p>
                  Your gain is the difference between the market value of your
                  shares and what you paid, including purchase fees.
                </p>
                <p>
                  Prices may be older for stocks that trade less often.
                  Dividends, taxes, and future selling fees are not included.
                </p>
              </div>
            </div>
          </section>
        )}
        <footer className="page-footer">
          <span>Built for a longer view.</span>
          <span>
            Market data from{" "}
            <a
              href="https://open.mse.mn/securities"
              target="_blank"
              rel="noreferrer"
            >
              Mongolian Stock Exchange <ArrowUpRight size={11} />
            </a>
          </span>
          {market && (
            <span>
              {market.coverage.priced} / {market.coverage.listed} stocks priced
            </span>
          )}
        </footer>
      </main>
      {editor !== null && (
        <HoldingForm
          instruments={instruments}
          holdings={holdings}
          initial={editor}
          save={saveHolding}
          close={() => setEditor(null)}
        />
      )}
      {selectedPosition && editor === null && (
        <PositionDetails
          position={selectedPosition}
          instrument={names.get(selectedPosition.holding.symbol)}
          close={() => setSelected(null)}
          edit={() => {
            setEditor(selectedPosition.holding);
            setSelected(null);
          }}
          remove={() => {
            commit(
              holdings.filter((h) => h.id !== selected),
              `${selectedPosition.holding.symbol} removed`,
            );
            setSelected(null);
          }}
        />
      )}
      {imported !== null && (
        <Sheet title="Review your import" close={() => setImported(null)}>
          <p className="sheet-intro">
            {imported.length} holding{imported.length === 1 ? "" : "s"} found.
            Importing will replace your personal portfolio of {personal.length}{" "}
            holdings.
          </p>
          <div className="import-list">
            {imported.slice(0, 30).map((h) => (
              <div key={h.id}>
                <strong>{h.symbol}</strong>
                <span>{quantity(h.quantity)} shares</span>
                <span>{formatMoney(h.averagePurchasePriceMnt)} / share</span>
              </div>
            ))}
            {imported.length > 30 && (
              <p>And {imported.length - 30} more holdings.</p>
            )}
          </div>
          <p className="field-help">
            Only the file’s holdings are imported. Nothing is uploaded. Export
            your current portfolio first if you need a backup.
          </p>
          <div className="detail-actions">
            <button className="button" onClick={() => setImported(null)}>
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                savePersonal(imported, `${imported.length} holdings imported`);
                setImported(null);
                setView("holdings");
                setSearch("");
                setFilter("all");
              }}
            >
              Replace portfolio
            </button>
          </div>
        </Sheet>
      )}
      {help && (
        <Sheet title="Your portfolio, explained" close={() => setHelp(false)}>
          <div className="help-copy">
            <h3>How gain / loss works</h3>
            <p>
              Purchase cost = shares × average purchase price + purchase fees.
            </p>
            <p>
              Market value = shares × the latest available MSE closing price.
            </p>
            <p>
              Unrealized gain / loss = market value − purchase cost. Return is
              gain divided by cost, across your priced holdings. A percentage is
              undefined when cost is zero.
            </p>
            <h3>Your data stays with you</h3>
            <p>
              Holdings are saved in this browser, with no sign-in or application
              database. Export a JSON backup to move them to another device.
              Clearing browser data can remove your portfolio.
            </p>
            <h3>About closing prices</h3>
            <p>
              Prices are collected daily from MSE’s public pages. Each stock
              keeps its actual source date. Missing or invalid prices are left
              unpriced, and stale prices remain dated.
            </p>
            {market && (
              <p>
                Current snapshot: {market.coverage.priced} of{" "}
                {market.coverage.listed} listed stocks have a validated close.{" "}
                {market.coverage.failed.length > 0
                  ? `${market.coverage.failed.length} source requests need review.`
                  : ""}
              </p>
            )}
            <p>
              This tracks unrealized gains on current holdings. It does not
              calculate realized gains, dividends, taxes, or fees you might pay
              when selling.
            </p>
            <a
              className="text-link"
              href="https://open.mse.mn/securities"
              target="_blank"
              rel="noreferrer"
            >
              Visit the MSE directory <ArrowUpRight size={14} />
            </a>
          </div>
        </Sheet>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </>
  );
}
