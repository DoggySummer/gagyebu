"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import type { ChartDatum } from "@/lib/constants";

const NARROW_BREAKPOINT = 768;

const SIZE = 260;
const P = 20;

interface DonutChartProps {
  data: ChartDatum[];
  animationKey?: string;
}

const ORANGE_PALETTE = [
  "#ea580c",
  "#f97316",
  "#fb923c",
  "#fdba74",
  "#fed7aa",
  "#ffedd5",
  "#fff7ed",
];

interface TooltipState {
  category: string;
  percentage: number;
  amount: number;
  x: number;
  y: number;
}

export default function DonutChart({ data, animationKey }: DonutChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const setTooltipRef = useRef<(v: TooltipState | null) => void>(() => {});
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);

  setTooltipRef.current = setTooltip;

  useEffect(() => {
    const check = () =>
      setIsNarrowScreen(typeof window !== "undefined" && window.innerWidth < NARROW_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const filtered = useMemo(
    () => data.filter((d) => d.amount > 0),
    [data]
  );
  const total = useMemo(
    () => filtered.reduce((sum, d) => sum + d.amount, 0),
    [filtered]
  );
  const legendItems = useMemo(
    () =>
      filtered.map((d, i) => ({
        category: d.category,
        amount: d.amount,
        percentage: total > 0 ? (d.amount / total) * 100 : 0,
        color: ORANGE_PALETTE[i % ORANGE_PALETTE.length],
      })),
    [filtered, total]
  );

  useEffect(() => {
    if (!svgRef.current || !filtered.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const radius = Math.min(SIZE, SIZE) / 2 - P;
    const innerRadius = radius * 0.55;

    const g = svg
      .append("g")
      .attr("transform", `translate(${SIZE / 2},${SIZE / 2})`);

    const pie = d3
      .pie<ChartDatum>()
      .value((d) => d.amount)
      .sort(null);

    const arc = d3
      .arc<d3.PieArcDatum<ChartDatum>>()
      .innerRadius(innerRadius)
      .outerRadius(radius);

    const color = d3
      .scaleOrdinal<string>()
      .domain(filtered.map((d) => d.category))
      .range(ORANGE_PALETTE);

    const paths = g
      .selectAll(".arc")
      .data(pie(filtered))
      .enter()
      .append("path")
      .attr("class", "arc")
      .attr("d", (d) => arc({ ...d, endAngle: d.startAngle }) ?? "")
      .attr("fill", (d) => color(d.data.category))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2)
      .on("mouseover", function (event, d) {
        const pct = total > 0 ? (d.data.amount / total) * 100 : 0;
        const e = event as MouseEvent;
        setTooltipRef.current?.({
          category: d.data.category,
          percentage: pct,
          amount: d.data.amount,
          x: e.clientX,
          y: e.clientY,
        });
      })
      .on("mouseout", function () {
        setTooltipRef.current?.(null);
      })
      .on("click", function (event, d) {
        const pct = total > 0 ? (d.data.amount / total) * 100 : 0;
        const e = event as MouseEvent;
        setTooltipRef.current?.({
          category: d.data.category,
          percentage: pct,
          amount: d.data.amount,
          x: e.clientX,
          y: e.clientY,
        });
      });

    paths
      .transition()
      .duration(800)
      .delay((_, i) => i * 60)
      .ease(d3.easeCubicOut)
      .attrTween("d", function (d) {
        const interp = d3.interpolate(
          { ...d, endAngle: d.startAngle },
          d
        );
        return (t) => arc(interp(t)) ?? "";
      });
  }, [data, animationKey, filtered, total]);

  return (
    <div className="flex flex-col min-[1700px]:flex-row items-center gap-4 w-full min-w-0">
      <div className="relative flex-shrink-0">
        <svg
          ref={svgRef}
          width={SIZE}
          height={SIZE}
          className="overflow-visible"
          style={{ maxWidth: "100%" }}
        />
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
              {tooltip.percentage.toFixed(1)}% · {tooltip.amount.toLocaleString()}원
            </div>
          </div>
        )}
      </div>
      {legendItems.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm flex-shrink-0 md:hidden lg:flex">
          {legendItems.map((item) => (
            <li
              key={item.category}
              className="flex items-center gap-2 text-[var(--text)]"
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: item.color }}
              />
              <span>{item.category}</span>
              <span className="text-[var(--text-muted)] ml-1">
                ({item.percentage.toFixed(1)}%)
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
