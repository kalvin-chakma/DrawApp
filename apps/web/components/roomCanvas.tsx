"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MousePointer2,
  Pencil,
  Square,
  Circle,
  Minus,
  Type,
  Eraser,
  ArrowLeft,
  Share2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Canvas, type ViewTransform } from "./canvas";
import { cn } from "@repo/ui/lib/utils";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";

type Tool =
  | "select"
  | "pencil"
  | "rect"
  | "circle"
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
  { id: "rect", icon: Square, label: "Rectangle", shortcut: "R", ready: false },
  { id: "circle", icon: Circle, label: "Ellipse", shortcut: "O", ready: false },
  { id: "line", icon: Minus, label: "Line", shortcut: "L", ready: false },
  { id: "text", icon: Type, label: "Text", shortcut: "T", ready: false },
  { id: "eraser", icon: Eraser, label: "Eraser", shortcut: "E", ready: true },
];

const COLORS = [
  "#1e1e1e",
  "#e03131",
  "#2f9e44",
  "#1971c2",
  "#f08c00",
  "#ae3ec9",
];

const STROKE_WIDTHS = [
  { value: 1.5, label: "Thin" },
  { value: 3, label: "Medium" },
  { value: 6, label: "Thick" },
];

// Screen-pixel radii for the eraser (independent of stroke width)
const ERASER_SIZES = [
  { value: 10, label: "Small" },
  { value: 22, label: "Medium" },
  { value: 40, label: "Large" },
];

export function RoomCanvas({
  roomId,
  roomSlug,
  token,
}: {
  roomId: string;
  roomSlug: string;
  token: string;
}) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<
    "connecting" | "connected" | "error" | "closed"
  >("connecting");
  const [selectedTool, setSelectedTool] = useState<Tool>("pencil");
  const [strokeColor, setStrokeColor] = useState(COLORS[0]!);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTHS[1]!.value);
  const [viewTransform, setViewTransform] = useState<ViewTransform>({
    tx: 0,
    ty: 0,
    scale: 1,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [eraserSize, setEraserSize] = useState(ERASER_SIZES[1]!.value);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const lastPanRef = useRef({ x: 0, y: 0 });
  const router = useRouter();

  // ── WebSocket ────────────────────────────────────────────
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

  // ── Keyboard shortcuts ───────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const tool = TOOLS.find(
        (t) => t.shortcut.toLowerCase() === e.key.toLowerCase() && t.ready,
      );
      if (tool) setSelectedTool(tool.id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Wheel zoom — centered on cursor ─────────────────────
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

  // ── Zoom helpers (buttons) — centered on viewport ────────
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

  // ── Pan handlers (select tool overlay) ──────────────────
  // `eraserSize` is already a screen-pixel radius — used directly for the cursor overlay.

  const handlePanStart = (e: React.MouseEvent) => {
    setIsPanning(true);
    lastPanRef.current = { x: e.clientX, y: e.clientY };
  };
  const handlePanMove = (e: React.MouseEvent) => {
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

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setMousePos(null)}
    >
      {/* ── Canvas ─────────────────────────────────────── */}
      <Canvas
        roomId={roomId}
        socket={socket}
        selectedTool={selectedTool}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        eraserSize={eraserSize}
        viewTransform={viewTransform}
      />

      {/* ── Eraser cursor overlay ──────────────────────── */}
      {selectedTool === "eraser" && mousePos && (
        <div
          className="pointer-events-none fixed z-20 rounded-full border-2 border-gray-700 bg-white/10"
          style={{
            width: eraserSize * 2,
            height: eraserSize * 2,
            left: mousePos.x - eraserSize,
            top: mousePos.y - eraserSize,
          }}
        />
      )}

      {/* ── Pan overlay (only when select tool active) ──── */}
      {selectedTool === "select" && (
        <div
          className="absolute inset-0 z-[5]"
          style={{ cursor: isPanning ? "grabbing" : "grab" }}
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={handlePanEnd}
          onMouseLeave={handlePanEnd}
        />
      )}

      {/* ── Top Bar ────────────────────────────────────── */}
      <header className="absolute top-3 left-0 right-0 flex items-center justify-between px-3 pointer-events-none z-10">
        <button
          onClick={() => router.push("/dashboard")}
          className="pointer-events-auto flex items-center gap-1.5 h-9 px-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/80 text-sm font-medium text-gray-700 hover:bg-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </button>

        <div className="pointer-events-auto h-9 px-4 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/80 flex items-center">
          <span className="text-sm font-semibold text-gray-800 max-w-[180px] truncate">
            {roomSlug}
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="h-9 px-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/80 flex items-center gap-2">
            <span
              className={cn(
                "w-2 h-2 rounded-full flex-shrink-0",
                statusConfig[status].dot,
              )}
            />
            <span className="text-xs font-medium text-gray-600">
              {statusConfig[status].label}
            </span>
          </div>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 h-9 px-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/80 text-sm font-medium text-gray-700 hover:bg-white transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
      </header>

      {/* ── Bottom Center Toolbar ───────────────────────── */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-0.5 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg shadow-black/10 border border-gray-200/80 px-2 py-2">
          {/* Tools */}
          {TOOLS.map((tool, idx) => {
            const Icon = tool.icon;
            const isActive = selectedTool === tool.id;
            const showSep = idx === 2; // separator before shape tools
            return (
              <div key={tool.id} className="flex items-center">
                {showSep && <div className="w-px h-5 bg-gray-200 mx-1.5" />}
                <div className="relative group">
                  <button
                    onClick={() => tool.ready && setSelectedTool(tool.id)}
                    disabled={!tool.ready}
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150",
                      isActive
                        ? "bg-gray-900 text-white shadow-sm scale-105"
                        : tool.ready
                          ? "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                          : "text-gray-300 cursor-not-allowed",
                    )}
                  >
                    <Icon size={17} />
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {tool.label}
                    {!tool.ready && " · soon"}
                    <span className="ml-1.5 opacity-50">{tool.shortcut}</span>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
              </div>
            );
          })}

          <div className="w-px h-5 bg-gray-200 mx-1.5" />

          {selectedTool === "eraser" ? (
            /* Eraser size picker */
            <div className="flex items-center gap-1.5 px-1">
              {ERASER_SIZES.map((es) => (
                <div key={es.value} className="relative group">
                  <button
                    onClick={() => setEraserSize(es.value)}
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                      eraserSize === es.value
                        ? "bg-gray-100"
                        : "hover:bg-gray-100",
                    )}
                  >
                    <div
                      className="rounded-full border-2 border-gray-500"
                      style={{ width: es.value * 0.9, height: es.value * 0.9 }}
                    />
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {es.label}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Stroke widths */}
              <div className="flex items-center gap-1.5 px-1">
                {STROKE_WIDTHS.map((sw) => (
                  <div key={sw.value} className="relative group">
                    <button
                      onClick={() => setStrokeWidth(sw.value)}
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                        strokeWidth === sw.value
                          ? "bg-gray-100"
                          : "hover:bg-gray-100",
                      )}
                    >
                      <div
                        className="rounded-full bg-gray-800"
                        style={{
                          width: sw.value * 2.5,
                          height: sw.value * 2.5,
                        }}
                      />
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {sw.label}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="w-px h-5 bg-gray-200 mx-1.5" />

              {/* Color swatches */}
              <div className="flex items-center gap-1.5 px-1">
                {COLORS.map((color) => (
                  <div key={color} className="relative group">
                    <button
                      onClick={() => setStrokeColor(color)}
                      className={cn(
                        "w-6 h-6 rounded-full transition-all duration-150 hover:scale-110",
                        strokeColor === color
                          ? "ring-2 ring-offset-2 ring-gray-400 scale-110"
                          : "",
                      )}
                      style={{ backgroundColor: color }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {color}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Zoom Controls (bottom-right) ────────────────── */}
      <div className="absolute bottom-6 right-4 z-10">
        <div className="flex items-center gap-0.5 bg-white/95 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/80 p-1">
          <button
            onClick={() => applyZoom(0.95)}
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
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
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
