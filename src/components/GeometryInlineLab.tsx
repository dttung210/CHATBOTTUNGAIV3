import React, { useState, useRef, useEffect } from "react";
import { GeometrySpecResponse, GeometryPoint } from "../types";
import { RotateCcw, EyeOff, Info } from "lucide-react";

interface GeometryInlineLabProps {
  spec: GeometrySpecResponse;
  onClose?: () => void;
}

export default function GeometryInlineLab({ spec, onClose }: GeometryInlineLabProps) {
  const [points, setPoints] = useState<GeometryPoint[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Load points from spec initially
  useEffect(() => {
    if (spec && spec.points) {
      setPoints(spec.points);
    }
  }, [spec]);

  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    const pt = points.find((p) => p.id === id);
    if (pt && pt.draggable !== false && spec.studentCanDrag) {
      setActiveDragId(id);
      if (svgRef.current) {
        svgRef.current.setPointerCapture(e.pointerId);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeDragId || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    // Compute SVG viewBox coordinates
    const x = ((e.clientX - rect.left) / rect.width) * 300;
    const y = ((e.clientY - rect.top) / rect.height) * 200;

    // Boundaries check to keep drawing within safe limits
    const safeX = Math.max(10, Math.min(290, x));
    const safeY = Math.max(10, Math.min(190, y));

    setPoints((prev) =>
      prev.map((p) => (p.id === activeDragId ? { ...p, x: Math.round(safeX), y: Math.round(safeY) } : p))
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeDragId) {
      if (svgRef.current) {
        svgRef.current.releasePointerCapture(e.pointerId);
      }
      setActiveDragId(null);
    }
  };

  const resetPoints = () => {
    if (spec && spec.points) {
      setPoints(spec.points);
    }
  };

  // Find points by ID
  const getPoint = (id: string) => points.find((p) => p.id === id);

  return (
    <div id="geometry-inline-lab" className="my-4 bg-white border border-[#CBEDE7]/60 rounded-xl p-4 shadow-sm w-full">
      <div className="flex items-center justify-between border-b border-[#CBEDE7]/40 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0F9D8A] animate-pulse" />
          <h4 className="font-semibold text-[#163A3A] text-xs uppercase tracking-wider">
            Quan sát hình học tương tác
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetPoints}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#0F9D8A] bg-[#CBEDE7]/30 hover:bg-[#CBEDE7]/50 rounded-xl font-bold transition-all cursor-pointer"
            title="Khôi phục điểm về vị trí ban đầu"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Khôi phục hình</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Ẩn hình</span>
            </button>
          )}
        </div>
      </div>

      <div className="relative flex justify-center bg-[#F7FFFD] border border-[#CBEDE7]/40 rounded-xl overflow-hidden p-2">
        <svg
          ref={svgRef}
          viewBox="0 0 300 200"
          className="w-full max-w-[450px] aspect-[3/2] touch-none select-none"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Grid lines for nice math blueprint feeling */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#D0F2EC/60" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Render segments */}
          {spec.segments &&
            spec.segments.map((seg, idx) => {
              const p1 = getPoint(seg.p1);
              const p2 = getPoint(seg.p2);
              if (!p1 || !p2) return null;
              return (
                <line
                  key={`seg-${idx}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={seg.color || (seg.isAccent ? "#0F9D8A" : "#587272")}
                  strokeWidth={seg.isAccent ? "2.5" : "1.5"}
                  strokeDasharray={seg.strokeDash || ""}
                />
              );
            })}

          {/* Render circles */}
          {spec.circles &&
            spec.circles.map((circ, idx) => {
              const center = getPoint(circ.center);
              if (!center) return null;
              return (
                <circle
                  key={`circ-${idx}`}
                  cx={center.x}
                  cy={center.y}
                  r={circ.radius}
                  fill="none"
                  stroke={circ.color || "#0F9D8A"}
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                />
              );
            })}

          {/* Render points & Labels */}
          {points.map((pt) => {
            const isDraggable = pt.draggable !== false && spec.studentCanDrag;
            return (
              <g key={`pt-${pt.id}`} className="group">
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isDraggable ? "6" : "4"}
                  fill={isDraggable ? "#FF8A00" : "#0F9D8A"}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  className={`${
                    isDraggable ? "cursor-grab active:cursor-grabbing hover:scale-125" : ""
                  } transition-transform duration-150`}
                  onPointerDown={(e) => handlePointerDown(pt.id, e)}
                />
                <text
                  x={pt.x + 8}
                  y={pt.y - 8}
                  fontSize="11"
                  fontWeight="bold"
                  fill="#163A3A"
                  className="pointer-events-none select-none font-sans"
                >
                  {pt.label || pt.id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-start gap-1.5 mt-3 text-xs text-[#587272]">
        <Info className="w-3.5 h-3.5 text-[#0F9D8A] mt-0.5 shrink-0" />
        <span>
          {spec.warning || "Hình vẽ trực quan hỗ trợ quan sát giả thiết bài toán. Em có thể di kéo các điểm màu cam."}
        </span>
      </div>
    </div>
  );
}
