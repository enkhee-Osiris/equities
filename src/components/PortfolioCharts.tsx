import { useState } from "react";
import type { Portfolio, Position } from "../lib/portfolio";
import { formatMoney, formatPercent } from "../lib/portfolio";
import { allocationColors, signed, tone } from "../lib/presentation";

interface PortfolioChartsProps {
  portfolio: Portfolio;
  onSelect: (id: string) => void;
}

export function PortfolioCharts({ portfolio, onSelect }: PortfolioChartsProps) {
  const [view, setView] = useState<"gain" | "value">("gain");
  const [expanded, setExpanded] = useState(false);
  const priced = portfolio.positions
    .filter(
      (
        position,
      ): position is Position & {
        value: NonNullable<Position["value"]>;
        gain: NonNullable<Position["gain"]>;
      } => position.value !== null && position.gain !== null,
    )
    .sort((a, b) => b.value.cmp(a.value));
  const visible = expanded ? priced : priced.slice(0, 6);
  const maxGain = priced.reduce(
    (max, position) =>
      position.gain.abs().greaterThan(max) ? position.gain.abs() : max,
    portfolio.gain.mul(0),
  );
  const maxValue = priced.reduce((max, position) => {
    const larger = position.cost.greaterThan(position.value)
      ? position.cost
      : position.value;
    return larger.greaterThan(max) ? larger : max;
  }, portfolio.value.mul(0));
  const largest = priced[0];
  const slices = priced.slice(0, 5).map((position, index) => ({
    label: position.holding.symbol,
    value: position.value,
    id: position.holding.id,
    color: allocationColors[index],
  }));
  if (priced.length > 5) {
    slices.push({
      label:
        priced.length === 6
          ? priced[5].holding.symbol
          : `Other (${priced.length - 5})`,
      value: priced
        .slice(5)
        .reduce(
          (sum, position) => sum.plus(position.value),
          portfolio.value.mul(0),
        ),
      id: priced.length === 6 ? priced[5].holding.id : "",
      color: allocationColors[5],
    });
  }
  let offset = 0;

  return (
    <section className="portfolio-charts" aria-label="Portfolio charts">
      <div className="performance-panel">
        <div className="chart-heading">
          <h2>Holding performance</h2>
          <div
            className="segmented"
            role="group"
            aria-label="Performance chart view"
          >
            <button
              className={view === "gain" ? "selected" : ""}
              aria-pressed={view === "gain"}
              onClick={() => setView("gain")}
            >
              Gain / loss
            </button>
            <button
              className={view === "value" ? "selected" : ""}
              aria-pressed={view === "value"}
              onClick={() => setView("value")}
            >
              Cost & value
            </button>
          </div>
        </div>
        <p className="chart-caption">
          {view === "gain"
            ? "Each holding’s contribution to your unrealized return."
            : "What you paid, including fees, against its latest market value."}
        </p>
        {priced.length ? (
          <>
            <div className="performance-axis" aria-hidden="true">
              <span />
              {view === "gain" ? (
                <div className="gain-axis">
                  <span>Loss</span>
                  <span>0</span>
                  <span>Gain</span>
                </div>
              ) : (
                <div className="cost-value-key">
                  <span>
                    <i className="cost-swatch" />
                    Purchase cost
                  </span>
                  <span>
                    <i className="value-swatch" />
                    Market value
                  </span>
                </div>
              )}
              <span />
            </div>
            <div
              className="performance-rows"
              role="group"
              aria-label={
                view === "gain"
                  ? "Gain and loss by holding"
                  : "Purchase cost and market value by holding"
              }
            >
              {visible.map((position) => {
                const gainWidth = maxGain.isZero()
                  ? 0
                  : position.gain.abs().div(maxGain).mul(50).toNumber();
                return (
                  <button
                    className="performance-row"
                    key={position.holding.id}
                    onClick={() => onSelect(position.holding.id)}
                    title={`View ${position.holding.symbol} holding details`}
                  >
                    <strong>{position.holding.symbol}</strong>
                    {view === "gain" ? (
                      <span className="gain-plot" aria-hidden="true">
                        <span
                          className={`gain-bar ${tone(position.gain)}`}
                          style={{
                            left: `${position.gain.isNegative() ? 50 - gainWidth : 50}%`,
                            width: `${gainWidth}%`,
                          }}
                        />
                        {position.gain.isZero() && (
                          <span className="zero-gain" />
                        )}
                      </span>
                    ) : (
                      <span className="value-plot" aria-hidden="true">
                        <span
                          className="cost-bar"
                          style={{
                            width: `${position.cost.div(maxValue).mul(100).toNumber()}%`,
                          }}
                        />
                        <span
                          className="market-value-bar"
                          style={{
                            width: `${position.value.div(maxValue).mul(100).toNumber()}%`,
                          }}
                        />
                      </span>
                    )}
                    <span className="chart-row-value">
                      <strong
                        className={view === "gain" ? tone(position.gain) : ""}
                      >
                        {view === "gain"
                          ? signed(position.gain)
                          : formatMoney(position.value)}
                      </strong>
                      <span>
                        {view === "gain"
                          ? formatPercent(position.returnPct)
                          : `Cost ${formatMoney(position.cost)}`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {priced.length > 6 && (
              <button
                className="chart-expand"
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded
                  ? "Show largest 6 holdings"
                  : `Show all ${priced.length} holdings`}
              </button>
            )}
          </>
        ) : (
          <p className="chart-empty">
            Your charts will appear when verified prices are available for your
            holdings.
          </p>
        )}
      </div>
      <div className="mix-panel">
        <div className="chart-heading">
          <h2>Portfolio mix</h2>
          <span>By market value</span>
        </div>
        <p className="chart-caption">
          See where your portfolio is concentrated.
        </p>
        {largest ? (
          <div className="mix-content">
            <div className="allocation-donut">
              <svg
                viewBox="0 0 160 160"
                role="img"
                aria-label={`Portfolio allocation by market value. ${slices.map((slice) => `${slice.label} ${slice.value.div(portfolio.value).mul(100).toFixed(1)}%`).join(", ")}.`}
              >
                {slices.map((slice) => {
                  const share = slice.value
                    .div(portfolio.value)
                    .mul(100)
                    .toNumber();
                  const start = offset;
                  offset += share;
                  return (
                    <circle
                      key={slice.label}
                      cx="80"
                      cy="80"
                      r="65"
                      pathLength="100"
                      fill="none"
                      stroke={slice.color}
                      strokeWidth="17"
                      strokeDasharray={`${share} ${100 - share}`}
                      strokeDashoffset={-start}
                      transform="rotate(-90 80 80)"
                    />
                  );
                })}
              </svg>
              <div className="donut-label" aria-hidden="true">
                <strong>
                  {largest.value.div(portfolio.value).mul(100).toFixed(1)}%
                </strong>
                <span>{largest.holding.symbol}</span>
                <small>Largest holding</small>
              </div>
            </div>
            <div className="mix-legend">
              {slices.map((slice) => {
                const label = (
                  <>
                    <span
                      className="legend-dot"
                      style={{ background: slice.color }}
                    />
                    <strong>{slice.label}</strong>
                    <span>
                      {slice.value.div(portfolio.value).mul(100).toFixed(1)}%
                    </span>
                  </>
                );
                return slice.id ? (
                  <button
                    key={slice.label}
                    onClick={() => onSelect(slice.id)}
                    aria-label={`View ${slice.label}, ${slice.value.div(portfolio.value).mul(100).toFixed(1)}% of portfolio`}
                  >
                    {label}
                  </button>
                ) : (
                  <div key={slice.label}>{label}</div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="chart-empty">
            Allocation needs at least one holding with a verified market value.
          </p>
        )}
      </div>
      <p className="charts-note">
        Current holdings at their latest available closes
        {portfolio.unpricedCount
          ? ` · ${portfolio.unpricedCount} unpriced holding${portfolio.unpricedCount === 1 ? "" : "s"} excluded`
          : ""}
        . Select a holding to see its dated price history.
      </p>
    </section>
  );
}
