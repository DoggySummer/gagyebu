"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
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
  const svgRef = useRef<SVGSVGElement>(null);
  const setTooltipRef = useRef<(v: TooltipState | null) => void>(() => {});
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [width, setWidth] = useState(W_MIN);

  setTooltipRef.current = setTooltip;

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

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const filteredData = data.filter((d) => d.amount > 0);
    if (!filteredData.length) return;

    const W = width;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const innerW = W - P.left - P.right;
    const innerH = H - P.top - P.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${P.left},${P.top})`);

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

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("fill", "#78716c")
      .attr("font-size", "11px");

    g.append("g")
      .call(d3.axisLeft(y).ticks(5))
      .selectAll("text")
      .attr("fill", "#78716c")
      .attr("font-size", "11px");

    const totalAmount = filteredData.reduce((sum, d) => sum + d.amount, 0);

    const bars = g
      .selectAll(".bar")
      .data(filteredData)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d.category) ?? 0)
      .attr("width", x.bandwidth())
      .attr("y", innerH)
      .attr("height", 0)
      .attr("fill", "#ea580c")
      .attr("rx", 4)
      .on("mouseover", function (event, d) {
        const pct = totalAmount > 0 ? (d.amount / totalAmount) * 100 : 0;
        setTooltipRef.current?.({
          category: d.category,
          amount: d.amount,
          percentage: pct,
          x: event.pageX,
          y: event.pageY,
        });
      })
      .on("mouseout", function () {
        setTooltipRef.current?.(null);
      });

    bars
      .transition()
      .duration(700)
      .delay((_, i) => i * 55)
      .ease(d3.easeBackOut.overshoot(0.6) as (t: number) => number)
      .attr("y", (d) => y(d.amount))
      .attr("height", (d) => innerH - y(d.amount));
  }, [data, animationKey, width]);

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <svg
        ref={svgRef}
        width={width}
        height={H}
        className="overflow-visible"
        style={{ maxWidth: "100%" }}
      />
      {tooltip && (
        <div
          className="fixed z-10 px-3 py-2 rounded-lg shadow-lg text-sm pointer-events-none border border-[var(--border)]"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y + 12,
            background: "var(--card-bg)",
            color: "var(--text)",
          }}
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
