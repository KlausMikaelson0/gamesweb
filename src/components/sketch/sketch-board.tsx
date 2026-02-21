"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Palette } from "lucide-react";
import type { DrawSegment } from "@/types/realtime";

interface SketchBoardProps {
  segments: DrawSegment[];
  canDraw: boolean;
  onSegment: (segment: DrawSegment) => void;
  onClear: () => void;
}

const COLORS = ["#f8fafc", "#fb7185", "#22d3ee", "#facc15", "#34d399", "#c084fc"];

export function SketchBoard({ segments, canDraw, onSegment, onClear }: SketchBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const previousPointRef = useRef<{ x: number; y: number } | null>(null);
  const [strokeColor, setStrokeColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(4);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const { clientWidth, clientHeight } = wrapper;
      canvas.width = clientWidth * ratio;
      canvas.height = clientHeight * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.clearRect(0, 0, clientWidth, clientHeight);
      segments.forEach((segment) => drawSegment(context, canvas, segment));
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(wrapper);
    return () => resizeObserver.disconnect();
  }, [segments]);

  const pointerToRelative = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;

    return { x: clamp01(x), y: clamp01(y) };
  };

  const drawAndEmit = (nextPoint: { x: number; y: number }) => {
    const previousPoint = previousPointRef.current;
    if (!previousPoint) {
      previousPointRef.current = nextPoint;
      return;
    }

    const segment: DrawSegment = {
      x0: previousPoint.x,
      y0: previousPoint.y,
      x1: nextPoint.x,
      y1: nextPoint.y,
      color: strokeColor,
      width: strokeWidth,
    };

    const context = canvasRef.current?.getContext("2d");
    const canvas = canvasRef.current;
    if (context && canvas) {
      drawSegment(context, canvas, segment);
    }

    onSegment(segment);
    previousPointRef.current = nextPoint;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-3">
        <div className="flex items-center gap-2 text-xs text-slate-200">
          <Palette className="h-4 w-4" />
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setStrokeColor(color)}
              className={`h-6 w-6 rounded-full border transition ${
                color === strokeColor ? "border-white scale-110" : "border-white/30"
              }`}
              style={{ backgroundColor: color }}
              aria-label={`Choose color ${color}`}
              disabled={!canDraw}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-300">
          <label htmlFor="strokeWidth">Brush</label>
          <input
            id="strokeWidth"
            type="range"
            min={2}
            max={14}
            value={strokeWidth}
            onChange={(event) => setStrokeWidth(Number(event.target.value))}
            disabled={!canDraw}
          />
          <button
            type="button"
            onClick={onClear}
            disabled={!canDraw}
            className="inline-flex items-center gap-1 rounded-lg border border-white/25 px-2 py-1 font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Eraser className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </div>

      <div
        ref={wrapperRef}
        className="relative h-[360px] overflow-hidden rounded-2xl border border-white/20 bg-slate-950 shadow-inner shadow-black/50 sm:h-[460px]"
      >
        <canvas
          ref={canvasRef}
          className={`h-full w-full touch-none ${
            canDraw ? "cursor-crosshair" : "cursor-not-allowed"
          }`}
          onPointerDown={(event) => {
            if (!canDraw) {
              return;
            }
            const point = pointerToRelative(event);
            if (!point) {
              return;
            }
            previousPointRef.current = point;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!canDraw) {
              return;
            }
            const point = pointerToRelative(event);
            if (!point) {
              return;
            }
            if ((event.buttons & 1) === 0) {
              previousPointRef.current = point;
              return;
            }
            drawAndEmit(point);
          }}
          onPointerUp={() => {
            previousPointRef.current = null;
          }}
          onPointerLeave={() => {
            previousPointRef.current = null;
          }}
        />
      </div>
    </div>
  );
}

function drawSegment(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  segment: DrawSegment,
) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  context.strokeStyle = segment.color;
  context.lineWidth = segment.width;
  context.beginPath();
  context.moveTo(segment.x0 * width, segment.y0 * height);
  context.lineTo(segment.x1 * width, segment.y1 * height);
  context.stroke();
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
