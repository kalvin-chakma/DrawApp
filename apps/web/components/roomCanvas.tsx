"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { useRouter } from "next/navigation";
import {
  MousePointer2,
  Pencil,
  Square,
  Circle,
  Triangle,
  Minus,
  Type,
  Eraser,
  ArrowLeft,
  Share2,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
} from "lucide-react";
import { PiShapesBold } from "react-icons/pi";
import type { LineVariant, Stroke } from "../app/draw/types";
import { Canvas, type CanvasHandle, type ViewTransform } from "./canvas";
import { cn } from "@repo/ui/lib/utils";
import { saveCanvas } from "../services/api";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";

type Tool =
  | "select"
  | "pencil"
  | "rect"
  | "circle"
  | "triangle"
  | "line"
  | "text"
  | "eraser";

interface ToolDef {
  id: Tool;
  icon: React.ElementType;
  label: string;
  shortcut: string;
  ready: boolean;
}

const TOOLS: ToolDef[] = [
  {
    id: "select",
    icon: MousePointer2,
    label: "Select",
    shortcut: "V",
    ready: true,
  },
  { id: "pencil", icon: Pencil, label: "Pencil", shortcut: "P", ready: true },
  { id: "line", icon: Minus, label: "Line", shortcut: "L", ready: true },
  { id: "text", icon: Type, label: "Text", shortcut: "T", ready: false },
  { id: "eraser", icon: Eraser, label: "Eraser", shortcut: "E", ready: true },
];

const SHAPE_TOOLS: ToolDef[] = [
  { id: "rect", icon: Square, label: "Rectangle", shortcut: "R", ready: true },
  { id: "circle", icon: Circle, label: "Ellipse", shortcut: "O", ready: true },
  {
    id: "triangle",
    icon: Triangle,
    label: "Triangle",
    shortcut: "G",
    ready: true,
  },
];

const COLORS = [
  "#1e1e1e",
  "#868e96",
  "#e64980",
  "#ae3ec9",
  "#4263eb",
  "#1971c2",
  "#f08c00",
  "#e8590c",
  "#2f9e44",
  "#66a80f",
  "#e03131",
  "#c92a2a",
];

const STROKE_WIDTH_RANGE = { min: 1, max: 10, step: 0.5 };
const ERASER_SIZE_RANGE = { min: 6, max: 15, step: 1 };

function SizeSlider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <SliderPrimitive.Root
      className="relative flex items-center select-none touch-none w-20 sm:w-24 h-8"
      min={min}
      max={max}
      step={step}
      value={[value]}
      onValueChange={([v]) => v !== undefined && onChange(v)}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow rounded-full bg-gray-200">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-gray-800" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block w-2.5 h-2.5 rounded-full bg-white border-2 border-gray-800 shadow-sm transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1"
        aria-label="Size"
      />
    </SliderPrimitive.Root>
  );
}

function LineVariantIcon({ variant }: { variant: LineVariant }) {
  const dashed = variant === "dashed" || variant === "dashed-arrow";
  const arrow = variant === "arrow" || variant === "dashed-arrow";
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
      <line
        x1="2"
        y1="7"
        x2={arrow ? "13" : "18"}
        y2="7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeDasharray={dashed ? "3 2.5" : undefined}
      />
      {arrow && (
        <path
          d="M13 7 L9.5 4.2 M13 7 L9.5 9.8"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

const LINE_VARIANTS: { value: LineVariant; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "arrow", label: "Arrow" },
  { value: "dashed", label: "Dashed" },
  { value: "dashed-arrow", label: "Dashed arrow" },
];

const CANVAS_SAVE_DEBOUNCE_MS = 1200;

export function RoomCanvas({
  roomId,
  roomSlug,
  token,
  initialStrokes,
  viewToken,
}: {
  roomId: string;
  roomSlug: string;
  token: string;
  initialStrokes?: Stroke[];
  viewToken?: string;
}) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<
    "connecting" | "connected" | "error" | "closed"
  >("connecting");
  const [selectedTool, setSelectedTool] = useState<Tool>("pencil");
  const [strokeColor, setStrokeColor] = useState(COLORS[0]!);
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [viewTransform, setViewTransform] = useState<ViewTransform>({
    tx: 0,
    ty: 0,
    scale: 1,
  });
  const [lineVariant, setLineVariant] = useState<LineVariant>("solid");
  const [isPanning, setIsPanning] = useState(false);
  const [copied, setCopied] = useState<"edit" | "view" | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const [eraserSize, setEraserSize] = useState(10);
  const [shapesMenuOpen, setShapesMenuOpen] = useState(false);
  const [shapesMenuPos, setShapesMenuPos] = useState<{
    left: number;
    bottom: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const shapesMenuRef = useRef<HTMLDivElement>(null);
  const shapesPopoverRef = useRef<HTMLDivElement>(null);
  const lastPanRef = useRef({ x: 0, y: 0 });
  const canvasHandleRef = useRef<CanvasHandle>(null);
  const router = useRouter();

  const handleUndo = useCallback(() => canvasHandleRef.current?.undo(), []);
  const handleRedo = useCallback(() => canvasHandleRef.current?.redo(), []);
  const handleHistoryChange = useCallback(
    (nextCanUndo: boolean, nextCanRedo: boolean) => {
      setCanUndo(nextCanUndo);
      setCanRedo(nextCanRedo);
    },
    [],
  );

  const activeShapeTool = SHAPE_TOOLS.find((t) => t.id === selectedTool);

  useEffect(() => setMounted(true), []);

  // Debounced auto-save of the canvas to the database
  const pendingStrokesRef = useRef<Stroke[] | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushCanvasSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (pendingStrokesRef.current) {
      saveCanvas(Number(roomId), pendingStrokesRef.current).catch(() => {});
      pendingStrokesRef.current = null;
    }
  }, [roomId]);

  const handleStrokesChange = useCallback(
    (strokes: Stroke[]) => {
      pendingStrokesRef.current = strokes;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(
        flushCanvasSave,
        CANVAS_SAVE_DEBOUNCE_MS,
      );
    },
    [flushCanvasSave],
  );

  useEffect(() => {
    return () => flushCanvasSave();
  }, [flushCanvasSave]);

  const toggleShapesMenu = () => {
    if (!shapesMenuOpen && shapesMenuRef.current) {
      const rect = shapesMenuRef.current.getBoundingClientRect();
      setShapesMenuPos({
        left: rect.left + rect.width / 2,
        bottom: window.innerHeight - rect.top + 10,
      });
    }
    setShapesMenuOpen((prev) => !prev);
  };

  // Close the shapes popover on outside click / Escape
  useEffect(() => {
    if (!shapesMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !shapesMenuRef.current?.contains(target) &&
        !shapesPopoverRef.current?.contains(target)
      ) {
        setShapesMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShapesMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [shapesMenuOpen]);

  // WebSocket
  useEffect(() => {
    if (!token || !roomId) return;
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    ws.onopen = () => {
      setStatus("connected");
      setSocket(ws);
      ws.send(JSON.stringify({ type: "join_room", roomId }));
    };
    ws.onerror = () => {
      setStatus("error");
      setSocket(null);
    };
    ws.onclose = () => {
      setStatus("closed");
      setSocket(null);
    };
    return () => {
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: "leave_room", roomId }));
      ws.close();
    };
  }, [roomId, token]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }

      const tool = [...TOOLS, ...SHAPE_TOOLS].find(
        (t) => t.shortcut.toLowerCase() === e.key.toLowerCase() && t.ready,
      );
      if (tool) setSelectedTool(tool.id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

  // Wheel zoom — centered on cursor
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.93;
      setViewTransform((prev) => {
        const newScale = Math.max(0.1, Math.min(8, prev.scale * factor));
        const ratio = newScale / prev.scale;
        return {
          scale: newScale,
          tx: e.clientX - (e.clientX - prev.tx) * ratio,
          ty: e.clientY - (e.clientY - prev.ty) * ratio,
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Zoom helpers (buttons) — centered on viewport
  const applyZoom = useCallback((factor: number) => {
    setViewTransform((prev) => {
      const newScale = Math.max(0.1, Math.min(8, prev.scale * factor));
      const ratio = newScale / prev.scale;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      return {
        scale: newScale,
        tx: cx - (cx - prev.tx) * ratio,
        ty: cy - (cy - prev.ty) * ratio,
      };
    });
  }, []);

  const resetZoom = useCallback(
    () => setViewTransform({ tx: 0, ty: 0, scale: 1 }),
    [],
  );

  // Pan handlers (select tool overlay)
  const handlePanStart = (e: React.MouseEvent | React.Touch) => {
    setIsPanning(true);
    lastPanRef.current = { x: e.clientX, y: e.clientY };
  };
  const handlePanMove = (e: React.MouseEvent | React.Touch) => {
    if (!isPanning) return;
    const dx = e.clientX - lastPanRef.current.x;
    const dy = e.clientY - lastPanRef.current.y;
    lastPanRef.current = { x: e.clientX, y: e.clientY };
    setViewTransform((prev) => ({
      ...prev,
      tx: prev.tx + dx,
      ty: prev.ty + dy,
    }));
  };
  const handlePanEnd = () => setIsPanning(false);

  // Pinch-to-zoom: called by the Canvas touch handler
  const handlePinch = useCallback((factor: number, cx: number, cy: number) => {
    setViewTransform((prev) => {
      const newScale = Math.max(0.1, Math.min(8, prev.scale * factor));
      const ratio = newScale / prev.scale;
      return {
        scale: newScale,
        tx: cx - (cx - prev.tx) * ratio,
        ty: cy - (cy - prev.ty) * ratio,
      };
    });
  }, []);

  const copyEditLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied("edit");
    setShareMenuOpen(false);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyViewLink = () => {
    if (!viewToken) return;
    const url = `${window.location.origin}/view/${viewToken}`;
    navigator.clipboard.writeText(url);
    setCopied("view");
    setShareMenuOpen(false);
    setTimeout(() => setCopied(null), 2000);
  };

  // Close the share popover on outside click / Escape
  useEffect(() => {
    if (!shareMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (!shareMenuRef.current?.contains(e.target as Node)) {
        setShareMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShareMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [shareMenuOpen]);

  const statusConfig = {
    connecting: { dot: "bg-yellow-400 animate-pulse", label: "Connecting" },
    connected: { dot: "bg-emerald-500", label: "Live" },
    error: { dot: "bg-red-500", label: "Error" },
    closed: { dot: "bg-gray-400", label: "Offline" },
  } as const;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden select-none bg-white"
    >
      <Canvas
        ref={canvasHandleRef}
        roomId={roomId}
        socket={socket}
        selectedTool={selectedTool}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        eraserSize={eraserSize}
        viewTransform={viewTransform}
        lineVariant={lineVariant}
        onPinchAction={handlePinch}
        initialStrokes={initialStrokes}
        onStrokesChange={handleStrokesChange}
        onHistoryChange={handleHistoryChange}
      />

      {selectedTool === "select" && (
        <div
          className="absolute inset-0 z-[5]"
          style={{ cursor: isPanning ? "grabbing" : "grab" }}
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={handlePanEnd}
          onMouseLeave={handlePanEnd}
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) handlePanStart(t);
          }}
          onTouchMove={(e) => {
            const t = e.touches[0];
            if (t) handlePanMove(t);
          }}
          onTouchEnd={handlePanEnd}
          onTouchCancel={handlePanEnd}
        />
      )}
      {/* Top Bar */}
      <header className="absolute top-3 left-0 right-0 flex items-center justify-between px-2 sm:px-3 pointer-events-none z-10 gap-1 sm:gap-2">
        <button
          onClick={() => router.push("/dashboard")}
          className="pointer-events-auto flex items-center gap-1.5 h-9 px-2.5 sm:px-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/80 text-sm font-medium text-gray-700 hover:bg-white active:scale-95 transition-all flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </button>

        <div className="pointer-events-auto h-9 px-2.5 sm:px-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/80 flex items-center min-w-0">
          <span className="text-sm font-semibold text-gray-800 max-w-[90px] sm:max-w-[180px] truncate">
            {roomSlug}
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-0.5 h-9 px-1 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/80 flex-shrink-0">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:scale-90 rounded-lg transition-all disabled:text-gray-300 disabled:hover:bg-transparent disabled:active:scale-100"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:scale-90 rounded-lg transition-all disabled:text-gray-300 disabled:hover:bg-transparent disabled:active:scale-100"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <div className="h-9 px-2 sm:px-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/80 flex items-center gap-2">
            <span
              className={cn(
                "w-2 h-2 rounded-full flex-shrink-0",
                statusConfig[status].dot,
              )}
            />
            <span className="text-xs font-medium text-gray-600 hidden sm:inline">
              {statusConfig[status].label}
            </span>
          </div>
          <div ref={shareMenuRef} className="relative">
            <button
              onClick={() => setShareMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/80 text-sm font-medium text-gray-700 hover:bg-white active:scale-95 transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {copied ? "Copied!" : "Share"}
              </span>
            </button>

            {shareMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg shadow-black/10 border border-gray-200/80 p-1.5 z-20">
                <button
                  onClick={copyEditLink}
                  className="flex flex-col items-start w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-800">
                    {copied === "edit" ? "Copied!" : "Copy edit link"}
                  </span>
                  <span className="text-xs text-gray-400">
                    Anyone signed in can draw
                  </span>
                </button>
                <button
                  onClick={copyViewLink}
                  disabled={!viewToken}
                  className="flex flex-col items-start w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <span className="text-sm font-medium text-gray-800">
                    {copied === "view" ? "Copied!" : "Copy view-only link"}
                  </span>
                  <span className="text-xs text-gray-400">
                    Read-only, no sign-in required
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      {/* Style Panel (top-right, below status/share) */}
      <div className="absolute top-16 right-2 sm:right-3 z-10 pointer-events-none max-h-[calc(100vh-5rem)]">
        <div className="pointer-events-auto flex flex-col gap-3 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg shadow-black/10 border border-gray-200/80 p-3 w-32 sm:w-36 max-h-[calc(100vh-5rem)] overflow-y-auto">
          {selectedTool !== "eraser" && (
            <div className="grid grid-cols-4 gap-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setStrokeColor(color)}
                  title={color}
                  className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center transition-all active:scale-90",
                    strokeColor === color ? "bg-gray-100" : "hover:bg-gray-100",
                  )}
                >
                  <span
                    className={cn(
                      "rounded-full transition-transform",
                      strokeColor === color ? "w-3.5 h-3.5" : "w-3 h-3",
                    )}
                    style={{ backgroundColor: color }}
                  />
                </button>
              ))}
            </div>
          )}

          <div
            className={cn(
              "flex items-center gap-2",
              selectedTool !== "eraser" && "pt-3 border-t border-gray-100",
            )}
          >
            <SizeSlider
              value={selectedTool === "eraser" ? eraserSize : strokeWidth}
              min={
                selectedTool === "eraser"
                  ? ERASER_SIZE_RANGE.min
                  : STROKE_WIDTH_RANGE.min
              }
              max={
                selectedTool === "eraser"
                  ? ERASER_SIZE_RANGE.max
                  : STROKE_WIDTH_RANGE.max
              }
              step={
                selectedTool === "eraser"
                  ? ERASER_SIZE_RANGE.step
                  : STROKE_WIDTH_RANGE.step
              }
              onChange={
                selectedTool === "eraser" ? setEraserSize : setStrokeWidth
              }
            />
            <span className="text-xs font-medium text-gray-500 tabular-nums w-6 text-right">
              {Math.round(selectedTool === "eraser" ? eraserSize : strokeWidth)}
            </span>
          </div>

          {selectedTool === "line" && (
            <div className="grid grid-cols-4 gap-1.5 pt-3 border-t border-gray-100">
              {LINE_VARIANTS.map((lv) => (
                <div key={lv.value} className="relative group">
                  <button
                    onClick={() => setLineVariant(lv.value)}
                    className={cn(
                      "w-full h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 text-gray-700",
                      lineVariant === lv.value
                        ? "bg-gray-100"
                        : "hover:bg-gray-100",
                    )}
                  >
                    <LineVariantIcon variant={lv.value} />
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 hidden sm:block">
                    {lv.label}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Bottom Center Toolbar */}
      <div className="absolute bottom-6 left-2 right-2 flex justify-center z-10 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-0.5 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg shadow-black/10 border border-gray-200/80 px-2 py-2">
          {TOOLS.map((tool, idx) => {
            const Icon = tool.icon;
            const isActive = selectedTool === tool.id;
            const showSep = idx === 2; // separator before the shapes group
            return (
              <div key={tool.id} className="flex items-center">
                {showSep && (
                  <>
                    {/* Shapes group — Rectangle / Ellipse behind one popover */}
                    <div ref={shapesMenuRef} className="relative group">
                      <button
                        onClick={toggleShapesMenu}
                        className={cn(
                          "w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-90",
                          activeShapeTool || shapesMenuOpen
                            ? "bg-gray-900 text-white shadow-sm scale-105"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                        )}
                      >
                        {activeShapeTool ? (
                          <activeShapeTool.icon size={16} />
                        ) : (
                          <PiShapesBold size={16} />
                        )}
                      </button>
                      {!shapesMenuOpen && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 hidden sm:block">
                          Shapes
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                        </div>
                      )}
                    </div>
                    <div className="w-px h-5 bg-gray-200 mx-1.5" />

                    {mounted &&
                      shapesMenuOpen &&
                      shapesMenuPos &&
                      createPortal(
                        <div
                          ref={shapesPopoverRef}
                          className="fixed flex items-center gap-1 bg-white rounded-xl shadow-lg shadow-black/10 border border-gray-200/80 p-1.5 z-50"
                          style={{
                            left: shapesMenuPos.left,
                            bottom: shapesMenuPos.bottom,
                            transform: "translateX(-50%)",
                          }}
                        >
                          {SHAPE_TOOLS.map((shape) => {
                            const ShapeIcon = shape.icon;
                            const shapeActive = selectedTool === shape.id;
                            return (
                              <div
                                key={shape.id}
                                className="relative group/shape"
                              >
                                <button
                                  onClick={() => {
                                    setSelectedTool(shape.id);
                                    setShapesMenuOpen(false);
                                  }}
                                  className={cn(
                                    "w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-90",
                                    shapeActive
                                      ? "bg-gray-900 text-white shadow-sm"
                                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                                  )}
                                >
                                  <ShapeIcon size={16} />
                                </button>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover/shape:opacity-100 transition-opacity pointer-events-none z-50 hidden sm:block">
                                  {shape.label}
                                  <span className="ml-1.5 opacity-50">
                                    {shape.shortcut}
                                  </span>
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                                </div>
                              </div>
                            );
                          })}
                        </div>,
                        document.body,
                      )}
                  </>
                )}
                <div className="relative group">
                  <button
                    onClick={() => tool.ready && setSelectedTool(tool.id)}
                    disabled={!tool.ready}
                    className={cn(
                      "w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-150",
                      isActive
                        ? "bg-gray-900 text-white shadow-sm scale-105"
                        : tool.ready
                          ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:scale-90"
                          : "text-gray-300 cursor-not-allowed",
                    )}
                  >
                    <Icon size={16} />
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 hidden sm:block">
                    {tool.label}
                    {!tool.ready && " · soon"}
                    <span className="ml-1.5 opacity-50">{tool.shortcut}</span>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Zoom Controls (bottom-right; stacked above the toolbar on narrow screens to avoid overlap) */}
      <div className="absolute bottom-24 right-2 sm:bottom-6 sm:right-4 z-10">
        <div className="flex items-center gap-0.5 bg-white/95 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/80 p-1">
          <button
            onClick={() => applyZoom(0.95)}
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-90 rounded-lg transition-all"
            title="Zoom out"
          >
            <ZoomOut size={13} />
          </button>
          <button
            onClick={resetZoom}
            title="Click to reset zoom"
            className="text-xs font-medium text-gray-600 w-12 text-center tabular-nums hover:bg-gray-100 rounded-lg h-7 transition-colors"
          >
            {Math.round(viewTransform.scale * 100)}%
          </button>
          <button
            onClick={() => applyZoom(1.05)}
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-90 rounded-lg transition-all"
            title="Zoom in"
          >
            <ZoomIn size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
