"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { motion } from "framer-motion";
import type { ChartDatum } from "@/lib/constants";

const W_MIN = 280;
const W_MAX = 640;
const H = 260;
const P = { top: 20, right: 20, bottom: 30, left: 56 };

interface BarChartProps {
  data: ChartDatum[];
  animationKey?: string;
}

interface TooltipState {
  category: string;
  amount: number;
  percentage: number;
  x: number;
  y: number;
}

export default function BarChart({ data, animationKey }: BarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xAxisRef = useRef<SVGGElement>(null);
  const yAxisRef = useRef<SVGGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [width, setWidth] = useState(W_MIN);

  // ResizeObserver — 그대로 유지
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? W_MIN;
      setWidth(Math.min(W_MAX, Math.max(W_MIN, w)));
    });
    ro.observe(el);
    setWidth(Math.min(W_MAX, Math.max(W_MIN, el.getBoundingClientRect().width)));
    return () => ro.disconnect();
  }, []);

  const filteredData = data.filter((d) => d.amount > 0);
  const totalAmount = filteredData.reduce((sum, d) => sum + d.amount, 0);

  const innerW = width - P.left - P.right;
  const innerH = H - P.top - P.bottom;

  // D3는 계산만
  const x = d3
    .scaleBand()
    .domain(filteredData.map((d) => d.category))
    .range([0, innerW])
    .padding(0.45);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(filteredData, (d) => d.amount) ?? 1])
    .nice()
    .range([innerH, 0]);

  // Axis는 D3에게 위임 (예외적으로 useRef 사용)
  useEffect(() => {
    if (xAxisRef.current) {
      d3.select(xAxisRef.current)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("fill", "#78716c")
        .attr("font-size", "11px");
    }
    if (yAxisRef.current) {
      d3.select(yAxisRef.current)
        .call(d3.axisLeft(y).ticks(5))
        .selectAll("text")
        .attr("fill", "#78716c")
        .attr("font-size", "11px");
    }
  }, [x, y]);

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <svg width={width} height={H} className="overflow-visible" style={{ maxWidth: "100%" }}>
        <g transform={`translate(${P.left},${P.top})`}>

          {/* Axis — D3가 그림 */}
          <g ref={xAxisRef} transform={`translate(0,${innerH})`} />
          <g ref={yAxisRef} />

          {/* Bars — React + Framer Motion이 그림 */}
          {filteredData.map((d) => {
            const barHeight = innerH - y(d.amount);
            const barY = y(d.amount);
            const pct = totalAmount > 0 ? (d.amount / totalAmount) * 100 : 0;

            return (
              <motion.rect
                key={`${animationKey}-${d.category}`} // key 변경 시 재애니메이션
                x={x(d.category) ?? 0}
                width={x.bandwidth()}
                rx={4}
                fill="#ea580c"
                // 애니메이션: y, height를 0 → 실제값
                initial={{ y: innerH, height: 0 }}
                animate={{ y: barY, height: barHeight }}
                transition={{
                  duration: 0.6,
                  ease: [0.34, 1.56, 0.64, 1], // easeBackOut과 유사한 spring feel
                  delay: filteredData.indexOf(d) * 0.055,
                }}
                onHoverStart={(event) => {
                  const e = event as unknown as MouseEvent;
                  setTooltip({ category: d.category, amount: d.amount, percentage: pct, x: e.pageX, y: e.pageY });
                }}
                onHoverEnd={() => setTooltip(null)}
                style={{ cursor: "pointer" }}
              />
            );
          })}
        </g>
      </svg>

      {/* Tooltip — 그대로 유지 */}
      {tooltip && (
        <div
          className="fixed z-10 px-3 py-2 rounded-lg shadow-lg text-sm pointer-events-none border border-[var(--border)]"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12, background: "var(--card-bg)", color: "var(--text)" }}
        >
          <div className="font-medium">{tooltip.category}</div>
          <div className="text-[var(--text-muted)]">
            {tooltip.percentage.toFixed(1)}% · {tooltip.amount.toLocaleString()}원
          </div>
        </div>
      )}
    </div>
  );
}