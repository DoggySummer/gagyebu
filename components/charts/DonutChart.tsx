"use client";

import { useMemo, useState, useEffect } from "react";
import * as d3 from "d3";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import type { ChartDatum } from "@/lib/constants";

const NARROW_BREAKPOINT = 768;
const SIZE = 260;
const P = 20;

const ORANGE_PALETTE = [
  "#ea580c", "#f97316", "#fb923c", "#fdba74",
  "#fed7aa", "#ffedd5", "#fff7ed",
];

interface DonutChartProps {
  data: ChartDatum[];
  animationKey?: string;
}

interface TooltipState {
  category: string;
  percentage: number;
  amount: number;
  x: number;
  y: number;
}

// ─── 세그먼트 컴포넌트 분리 (hooks-in-loop 방지) ───
interface SegmentProps {
  pieData: d3.PieArcDatum<ChartDatum>;
  arc: d3.Arc<unknown, d3.PieArcDatum<ChartDatum>>;
  color: string;
  index: number;
  animationKey?: string;
  onHover: (e: React.MouseEvent, d: d3.PieArcDatum<ChartDatum>) => void;
  onLeave: () => void;
}

function DonutSegment({ pieData, arc, color, index, animationKey, onHover, onLeave }: SegmentProps) {
  // D3 보간을 Framer Motion progress로 구동
  const progress = useMotionValue(0);

  useEffect(() => {
    progress.set(0);
    const controls = animate(progress, 1, {
      duration: 0.75,
      delay: index * 0.06,
      ease: [0.25, 0.46, 0.45, 0.94], // easeCubicOut 근사
    });
    return controls.stop;
  }, [animationKey]); // animationKey 바뀌면 재애니메이션

  const d = useTransform(progress, (p) => {
    // D3 보간: endAngle을 startAngle → 실제값으로 보간 (기존 attrTween 동일 효과)
    const interp = d3.interpolate(
      { ...pieData, endAngle: pieData.startAngle },
      pieData
    );
    return arc(interp(p)) ?? "";
  });

  return (
    <motion.path
      d={d}
      fill={color}
      stroke="#ffffff"
      strokeWidth={2}
      style={{ cursor: "pointer" }}
      whileHover={{ scale: 1.03 }}        // 호버 시 살짝 확대 (보너스)
      transition={{ type: "spring", stiffness: 300 }}
      onMouseMove={(e) => onHover(e, pieData)}
      onMouseLeave={onLeave}
      onClick={(e) => onHover(e, pieData)}
    />
  );
}

// ─── 메인 컴포넌트 ───
export default function DonutChart({ data, animationKey }: DonutChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);

  useEffect(() => {
    const check = () => setIsNarrowScreen(window.innerWidth < NARROW_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const filtered = useMemo(() => data.filter((d) => d.amount > 0), [data]);
  const total = useMemo(() => filtered.reduce((sum, d) => sum + d.amount, 0), [filtered]);

  // D3는 계산만
  const radius = SIZE / 2 - P;
  const innerRadius = radius * 0.55;

  const pie = useMemo(
    () => d3.pie<ChartDatum>().value((d) => d.amount).sort(null),
    []
  );
  const arc = useMemo(
    () => d3.arc<d3.PieArcDatum<ChartDatum>>().innerRadius(innerRadius).outerRadius(radius),
    [innerRadius, radius]
  );
  const pieData = useMemo(() => pie(filtered), [pie, filtered]);

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

  const handleHover = (e: React.MouseEvent, d: d3.PieArcDatum<ChartDatum>) => {
    const pct = total > 0 ? (d.data.amount / total) * 100 : 0;
    setTooltip({
      category: d.data.category,
      percentage: pct,
      amount: d.data.amount,
      x: e.clientX,
      y: e.clientY,
    });
  };

  return (
    <div className="flex flex-col min-[1700px]:flex-row items-center gap-4 w-full min-w-0">
      <div className="relative flex-shrink-0">
        <svg width={SIZE} height={SIZE} className="overflow-visible" style={{ maxWidth: "100%" }}>
          <g transform={`translate(${SIZE / 2},${SIZE / 2})`}>
            {pieData.map((d, i) => (
              <DonutSegment
                key={d.data.category}
                pieData={d}
                arc={arc}
                color={ORANGE_PALETTE[i % ORANGE_PALETTE.length]}
                index={i}
                animationKey={animationKey}
                onHover={handleHover}
                onLeave={() => setTooltip(null)}
              />
            ))}
          </g>
        </svg>

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
            <li key={item.category} className="flex items-center gap-2 text-[var(--text)]">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.color }} />
              <span>{item.category}</span>
              <span className="text-[var(--text-muted)] ml-1">({item.percentage.toFixed(1)}%)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}