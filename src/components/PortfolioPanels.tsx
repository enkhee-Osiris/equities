import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { ArrowUpRight, Check, LockKeyhole, Trash2, X } from "lucide-react";
import Decimal from "decimal.js";
import {
  formatMoney,
  formatPercent,
  validateHoldings,
  type Holding,
  type Instrument,
  type Position,
} from "../lib/portfolio";
import {
  dateLabel,
  errorMessage,
  quantity,
  signed,
  tone,
} from "../lib/presentation";

const BASE = import.meta.env.BASE_URL;

interface SheetProps {
  title: string;
  children: ReactNode;
  close: () => void;
}

export function Sheet({ title, children, close }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      className="sheet"
      ref={ref}
      aria-label={title}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="sheet-content">
        <header className="sheet-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close panel"
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

interface HoldingFormProps {
  instruments: Instrument[];
  holdings: Holding[];
  initial?: Holding | string;
  save: (holding: Holding) => void;
  close: () => void;
}

export function HoldingForm({
  instruments,
  holdings,
  initial,
  save,
  close,
}: HoldingFormProps) {
  const editing = typeof initial === "object" ? initial : null;
  const [symbol, setSymbol] = useState(
    editing?.symbol || (typeof initial === "string" ? initial : ""),
  );
  const [shares, setShares] = useState(editing?.quantity || "");
  const [price, setPrice] = useState(editing?.averagePurchasePriceMnt || "");
  const [fees, setFees] = useState(editing?.purchaseFeesMnt || "0");
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const next = validateHoldings([
        {
          id: editing?.id || crypto.randomUUID(),
          symbol,
          quantity: shares,
          averagePurchasePriceMnt: price,
          purchaseFeesMnt: fees || "0",
        },
      ])[0];
      validateHoldings([...holdings.filter((h) => h.id !== next.id), next]);
      save(next);
    } catch (error) {
      setError(errorMessage(error));
    }
  }
  return (
    <Sheet title={editing ? "Edit holding" : "Add a holding"} close={close}>
      <p className="muted sheet-intro">
        Enter your current shares and average purchase price. Include fees
        separately.
      </p>
      <form className="holding-form" onSubmit={submit}>
        <label htmlFor="symbol">Stock symbol</label>
        <input
          id="symbol"
          list="stock-options"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Search a symbol, e.g. APU"
          required
          autoFocus
          autoComplete="off"
        />
        <datalist id="stock-options">
          {instruments
            .filter((i) => i.status === "listed")
            .map((i) => (
              <option key={i.sourceId} value={i.symbol}>
                {i.nameMn}
              </option>
            ))}
        </datalist>
        {symbol && (
          <span className="field-help">
            {instruments.find((i) => i.symbol === symbol)?.nameMn ||
              "Unknown symbols can be saved, but may not have a price."}
          </span>
        )}
        <label htmlFor="shares">Number of shares</label>
        <input
          id="shares"
          inputMode="decimal"
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          placeholder="1000"
          required
        />
        <label htmlFor="price">
          Average purchase price <span>MNT per share</span>
        </label>
        <input
          id="price"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.00"
          required
        />
        <label htmlFor="fees">
          Total purchase fees <span>MNT · optional</span>
        </label>
        <input
          id="fees"
          inputMode="decimal"
          value={fees}
          onChange={(e) => setFees(e.target.value)}
        />
        <p className="field-help">
          Use plain numbers without commas. Average price excludes fees; they
          are added to your purchase cost once.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" type="submit">
          <Check size={17} />
          {editing ? "Save changes" : "Add holding"}
        </button>
        <p className="private-note">
          <LockKeyhole size={14} /> Saved on this device. No account needed.
        </p>
      </form>
    </Sheet>
  );
}

type HistoryPoint = { date: string; close: string };

interface PriceHistoryProps {
  sourceId: string;
  cost?: Decimal;
}

export function PriceHistory({ sourceId, cost }: PriceHistoryProps) {
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);
  const [range, setRange] = useState(90);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${BASE}market/history/${encodeURIComponent(sourceId)}.json`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error();
        setPoints(
          data
            .filter(
              (p) =>
                typeof p.date === "string" &&
                new Decimal(p.close).greaterThan(0),
            )
            .sort((a, b) => a.date.localeCompare(b.date)),
        );
      })
      .catch((e) => {
        if (e.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, [sourceId]);
  if (failed || points?.length === 0)
    return (
      <p className="empty-chart">
        Dated price history is not available for this stock yet.
      </p>
    );
  if (!points) return <p className="empty-chart">Loading dated prices…</p>;
  const last = points.at(-1)!;
  const cutoff =
    new Date(`${last.date}T00:00:00Z`).getTime() - range * 86400000;
  const visible = points.filter(
    (p) => new Date(`${p.date}T00:00:00Z`).getTime() >= cutoff,
  );
  const values = visible.map((p) => Number(p.close));
  const min = Math.min(...values, cost?.toNumber() ?? Infinity) * 0.98;
  const max = Math.max(...values, cost?.toNumber() ?? -Infinity) * 1.02;
  const y = (v: number) => 152 - ((v - min) / (max - min || 1)) * 132;
  const path = values
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${20 + (i / Math.max(1, values.length - 1)) * 336},${y(v)}`,
    )
    .join(" ");
  return (
    <section className="price-history">
      <div className="subheading">
        <h3>Closing price</h3>
        <div className="segmented">
          {[
            [30, "1M"],
            [90, "3M"],
            [365, "1Y"],
          ].map(([n, label]) => (
            <button
              key={n}
              className={range === n ? "selected" : ""}
              onClick={() => setRange(Number(n))}
              aria-pressed={range === n}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <svg
        viewBox="0 0 376 180"
        role="img"
        aria-label={`Closing prices from ${dateLabel(visible[0].date)} to ${dateLabel(last.date)}. Latest ${formatMoney(last.close)}.`}
      >
        {[35, 95, 152].map((v) => (
          <line key={v} x1="20" x2="356" y1={v} y2={v} stroke="var(--line)" />
        ))}
        {cost && (
          <line
            x1="20"
            x2="356"
            y1={y(cost.toNumber())}
            y2={y(cost.toNumber())}
            stroke="#a3a9af"
            strokeDasharray="4 5"
          />
        )}
        <path
          d={`${path} L356,152 L20,152 Z`}
          fill="var(--accent)"
          opacity=".045"
        />
        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle
          cx={values.length > 1 ? 356 : 20}
          cy={y(Number(last.close))}
          r="3"
          fill="var(--accent)"
        />
        <text x="20" y="174">
          {dateLabel(visible[0].date)}
        </text>
        <text x="356" y="174" textAnchor="end">
          {dateLabel(last.date)}
        </text>
      </svg>
      <p className="field-help">
        Unadjusted MSE closing prices.
        {cost ? " Dashed line: your average cost including purchase fees." : ""}
      </p>
    </section>
  );
}

interface PositionDetailsProps {
  position: Position;
  instrument?: Instrument;
  close: () => void;
  edit: () => void;
  remove: () => void;
}

export function PositionDetails({
  position,
  instrument,
  close,
  edit,
  remove,
}: PositionDetailsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { holding, quote, cost, value, gain, returnPct } = position;
  return (
    <Sheet title={holding.symbol} close={close}>
      <p className="company-title">
        {instrument?.nameMn || "Company not in the current directory"}
      </p>
      <div className="detail-value">
        <span>Market value</span>
        <strong>{value ? formatMoney(value, 0) : "Price unavailable"}</strong>
        <span className={tone(gain)}>
          {signed(gain)}{" "}
          <span className="muted">({formatPercent(returnPct)})</span>
        </span>
      </div>
      <dl className="detail-list">
        <div>
          <dt>Shares owned</dt>
          <dd>{quantity(holding.quantity)}</dd>
        </div>
        <div>
          <dt>Average purchase price</dt>
          <dd>{formatMoney(holding.averagePurchasePriceMnt)}</dd>
        </div>
        <div>
          <dt>Purchase fees</dt>
          <dd>{formatMoney(holding.purchaseFeesMnt)}</dd>
        </div>
        <div>
          <dt>Total purchase cost</dt>
          <dd>{formatMoney(cost)}</dd>
        </div>
        <div>
          <dt>Latest dated close</dt>
          <dd>{quote ? formatMoney(quote.close) : "Unavailable"}</dd>
        </div>
        <div>
          <dt>Price date</dt>
          <dd>{quote ? dateLabel(quote.date, true) : "—"}</dd>
        </div>
      </dl>
      {quote && (
        <PriceHistory
          sourceId={quote.sourceId}
          cost={cost.div(holding.quantity)}
        />
      )}
      {instrument && (
        <a
          href={instrument.profileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-link"
        >
          View company on MSE <ArrowUpRight size={15} />
        </a>
      )}
      <div className="detail-actions">
        <button className="button primary" onClick={edit}>
          Edit holding
        </button>
        <button
          className="button danger"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={16} />
          Remove
        </button>
      </div>
      {confirmDelete && (
        <div className="delete-confirm">
          <p>Remove {holding.symbol} from this portfolio?</p>
          <button className="button danger" onClick={remove}>
            Yes, remove holding
          </button>
          <button className="button" onClick={() => setConfirmDelete(false)}>
            Keep holding
          </button>
        </div>
      )}
    </Sheet>
  );
}
