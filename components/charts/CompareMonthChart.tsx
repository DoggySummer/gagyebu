"use client";

import { useState, useEffect, useMemo } from "react";
import * as d3 from "d3";
import { motion } from "framer-motion";
import { getTransactions } from "@/actions/transactions";
import { aggregateByCategory, CATEGORIES, type ChartDatum } from "@/lib/constants";

const H = 260;
const P = { top: 20, right: 20, bottom: 30, left: 76 };
const BAR_MIN_HOVER_HEIGHT = 24;

interface CompareMonthChartProps {
  chartData: ChartDatum[];
  year: number;
  month: number;
}

interface TooltipState {
  category: string;
  diff: number;
  x: number;
  y: number;
}

// ─── 바 세그먼트 분리 (hooks-in-loop 방지) ───
interface DiffBarProps {
  category: string;
  diff: number;
  x: number;
  barWidth: number;
  y: number;
  height: number;
  zeroY: number;
  fill: string;
  animationKey: string;
  index: number;
  onHover: (e: React.MouseEvent, category: string, diff: number) => void;
  onLeave: () => void;
}

function DiffBar({ category, diff, x, barWidth, y, height, zeroY, fill, animationKey, index, onHover, onLeave }: DiffBarProps) {
  const isPositive = diff >= 0;
  const hoverHeight = Math.max(height, BAR_MIN_HOVER_HEIGHT);
  const hoverY = y - (hoverHeight - height) / 2;

  return (
    <g key={category}>
      {/* 실제 막대 — Framer Motion */}
      <motion.rect
        key={`${animationKey}-${category}`}
        x={x}
        width={barWidth}
        rx={2}
        fill={fill}
        // zeroY에서 시작해서 실제 위치로 확장
        initial={{ y: zeroY, height: 0 }}
        animate={{ y, height }}
        transition={{
          duration: 0.55,
          delay: index * 0.05,
          ease: isPositive
            ? [0.34, 1.56, 0.64, 1]   // 증가: 약간 바운스
            : [0.25, 0.46, 0.45, 0.94], // 감소: 부드럽게
        }}
      />
      {/* 호버 영역 — 투명 rect */}
      <rect
        x={x}
        y={hoverY}
        width={barWidth}
        height={hoverHeight}
        fill="transparent"
        style={{ cursor: "pointer" }}
        onMouseEnter={(e) => onHover(e, category, diff)}
        onMouseLeave={onLeave}
      />
    </g>
  );
}

// ─── 메인 컴포넌트 ───
export default function CompareMonthChart({ chartData, year, month }: CompareMonthChartProps) {
  const [compareMonthKey, setCompareMonthKey] = useState<string | null>(null);
  const [compareChartData, setCompareChartData] = useState<ChartDatum[]>([]);
  const [chartWidth, setChartWidth] = useState(320);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);

  // ResizeObserver — containerRef 대신 callback ref
  const containerRef = (el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 320;
      setChartWidth(Math.min(640, Math.max(240, w)));
    });
    ro.observe(el);
    setChartWidth(Math.min(640, Math.max(240, el.getBoundingClientRect().width || 320)));
  };

  useEffect(() => {
    const check = () => setIsNarrowScreen(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!compareMonthKey) { setCompareChartData([]); return; }
    getTransactions(compareMonthKey).then((txs) => setCompareChartData(aggregateByCategory(txs)));
  }, [compareMonthKey]);

  const compareMonthOptions = useMemo(() => {
    const options: { key: string; label: string }[] = [];
    const d = new Date(year, month - 1, 1);
    for (let i = 1; i <= 12; i++) {
      d.setMonth(d.getMonth() - 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      options.push({ key: `${y}-${String(m).padStart(2, "0")}`, label: `${y}년 ${m}월` });
    }
    return options;
  }, [year, month]);

  const innerW = chartWidth - P.left - P.right;
  const innerH = H - P.top - P.bottom;

  // D3는 계산만
  const scales = useMemo(() => {
    if (!compareMonthKey || compareChartData.length === 0 || innerW <= 0) return null;

    const diffData = CATEGORIES.map((category) => {
      const current = chartData.find((d) => d.category === category)?.amount ?? 0;
      const compare = compareChartData.find((d) => d.category === category)?.amount ?? 0;
      return { category, diff: current - compare };
    });

    const allDiffs = diffData.map((d) => d.diff);
    const extent = Math.max(Math.abs(Math.min(0, ...allDiffs)), Math.abs(Math.max(0, ...allDiffs)), 1);

    const xScale = d3.scaleBand<string>().domain(CATEGORIES).range([0, innerW]).padding(0.35);
    const yScale = d3.scaleLinear().domain([-extent, extent]).range([innerH, 0]);
    const zeroY = yScale(0);

    return { diffData, xScale, yScale, zeroY };
  }, [compareMonthKey, compareChartData, chartData, innerW]);

  const summary = useMemo(() => {
    if (!compareMonthKey || compareChartData.length === 0) return null;
    const totalDiff =
      chartData.reduce((s, d) => s + d.amount, 0) -
      compareChartData.reduce((s, d) => s + d.amount, 0);
    const increased: string[] = [];
    const decreased: string[] = [];
    CATEGORIES.forEach((cat) => {
      const diff =
        (chartData.find((d) => d.category === cat)?.amount ?? 0) -
        (compareChartData.find((d) => d.category === cat)?.amount ?? 0);
      if (diff > 0) increased.push(cat);
      else if (diff < 0) decreased.push(cat);
    });
    return { totalDiff, increased, decreased };
  }, [compareMonthKey, compareChartData, chartData]);

  const handleHover = (e: React.MouseEvent, category: string, diff: number) => {
    setTooltip({ category, diff, x: e.clientX, y: e.clientY });
  };

  return (
    <div
      className="rounded-xl border border-[var(--border)] p-6 flex flex-col items-center flex-1 min-h-[340px] min-w-0"
      style={{ background: "var(--card-bg)" }}
    >
      <h2 className="text-sm font-medium text-[var(--text-muted)] mb-4">이전 월과 비교</h2>

      <div className="mb-3 w-full max-w-[180px]">
        <select
          value={compareMonthKey ?? ""}
          onChange={(e) => setCompareMonthKey(e.target.value || null)}
          className="input-dark rounded-lg px-3 py-2 text-sm w-full"
          aria-label="비교할 월 선택"
        >
          <option value="">비교할 월 선택</option>
          {compareMonthOptions.map(({ key, label }) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {compareMonthKey && scales ? (
        <div className="flex flex-col min-[2300px]:flex-row gap-4 w-full min-w-0 items-center">
          <div
            ref={containerRef}
            className="min-w-0 overflow-x-auto flex-shrink-0 w-full flex justify-center min-[2300px]:w-auto"
            style={{ maxWidth: 640 }}
          >
            <svg width={chartWidth} height={H} className="overflow-visible" style={{ maxWidth: "100%" }}>
              <g transform={`translate(${P.left},${P.top})`}>

                {/* 그리드 라인 — React 직접 렌더 */}
                <line x1={0} x2={innerW} y1={scales.zeroY} y2={scales.zeroY}
                  stroke="var(--border)" strokeWidth={1} strokeDasharray="4,2" />
                {scales.yScale.ticks(5).map((tick) => (
                  <g key={tick} transform={`translate(0,${scales.yScale(tick)})`}>
                    <line x1={0} x2={innerW} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="2,2" />
                    <text x={-8} y={0} dy="0.32em" textAnchor="end" fill="#78716c" fontSize={11}>
                      {tick >= 0 ? `+${tick.toLocaleString()}` : tick.toLocaleString()}
                    </text>
                  </g>
                ))}

                {/* X축 레이블 */}
                {CATEGORIES.map((cat) => (
                  <text
                    key={cat}
                    x={(scales.xScale(cat) ?? 0) + scales.xScale.bandwidth() / 2}
                    y={innerH + 20}
                    textAnchor="middle"
                    fill="#78716c"
                    fontSize={11}
                  >
                    {cat}
                  </text>
                ))}

                {/* 막대 — DiffBar 컴포넌트 */}
                {scales.diffData.map(({ category, diff }, i) => {
                  const x = scales.xScale(category) ?? 0;
                  const y0 = scales.zeroY;
                  const y1 = scales.yScale(diff);
                  const y = Math.min(y0, y1);
                  const height = Math.abs(y1 - y0);
                  const fill = diff > 0 ? "#dc2626" : diff < 0 ? "#059669" : "var(--text-muted)";

                  return (
                    <DiffBar
                      key={category}
                      category={category}
                      diff={diff}
                      x={x}
                      barWidth={scales.xScale.bandwidth()}
                      y={y}
                      height={height}
                      zeroY={scales.zeroY}
                      fill={fill}
                      animationKey={compareMonthKey}
                      index={i}
                      onHover={handleHover}
                      onLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </g>
            </svg>
          </div>

          {summary && (
            <div className="text-sm min-w-0 max-w-[220px] min-[2300px]:max-w-[260px] w-full space-y-4 pt-1 text-left self-start">
              <div>
                <p className="text-[var(--text-muted)] mb-0.5">총 지출 비교</p>
                <p>
                  {summary.totalDiff > 0 ? (
                    <span className="text-red-600 font-medium">{summary.totalDiff.toLocaleString()}원 증가</span>
                  ) : summary.totalDiff < 0 ? (
                    <span className="text-emerald-600 font-medium">{Math.abs(summary.totalDiff).toLocaleString()}원 감소</span>
                  ) : (
                    <span className="text-[var(--text-muted)]">변동 없음</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-[var(--text-muted)] mb-0.5">늘어난 카테고리</p>
                <p className="text-red-600">{summary.increased.length > 0 ? summary.increased.join(", ") : "-"}</p>
              </div>
              <div>
                <p className="text-[var(--text-muted)] mb-0.5">줄어든 카테고리</p>
                <p className="text-emerald-600">{summary.decreased.length > 0 ? summary.decreased.join(", ") : "-"}</p>
              </div>
            </div>
          )}
        </div>
      ) : compareMonthKey ? (
        <p className="text-sm text-[var(--text-muted)]">불러오는 중...</p>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">위에서 비교할 월을 선택하세요.</p>
      )}

      {tooltip && (
        <div
          className="fixed z-10 px-3 py-2 rounded-lg shadow-lg text-sm pointer-events-none border border-[var(--border)]"
          style={{
            left: isNarrowScreen ? 12 : tooltip.x + 12,
            top: tooltip.y + 12,
            background: "var(--card-bg)",
            color: "var(--text)",
          }}
        >
          <div className="font-medium">{tooltip.category}</div>
          <div className="text-[var(--text-muted)]">
            {tooltip.diff > 0 ? (
              <span className="text-red-600">+{tooltip.diff.toLocaleString()}원 증가</span>
            ) : tooltip.diff < 0 ? (
              <span className="text-emerald-600">{tooltip.diff.toLocaleString()}원 감소</span>
            ) : "변동 없음"}
          </div>
        </div>
      )}
    </div>
  );
}