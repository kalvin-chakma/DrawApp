"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, LogIn, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { Canvas, type ViewTransform } from "../../../components/canvas";
import { getRoomByViewToken } from "../../../services/api";
import type { Stroke } from "../../draw/types";

interface Room {
  id: number;
  slug: string;
  canvasState: Stroke[] | null;
}

export default function ViewRoomPage({
  params,
}: {
  params: Promise<{ viewToken: string }>;
}) {
  const { viewToken } = use(params);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [renderKey, setRenderKey] = useState(0);
  const [viewTransform, setViewTransform] = useState<ViewTransform>({
    tx: 0,
    ty: 0,
    scale: 1,
  });
  const [isPanning, setIsPanning] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const lastPanRef = useRef({ x: 0, y: 0 });
  const router = useRouter();

  const fetchRoom = useCallback(async () => {
    try {
      const res = await getRoomByViewToken(viewToken);
      setRoom(res.data);
      setError("");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Room not found");
    }
  }, [viewToken]);

  useEffect(() => {
    fetchRoom().finally(() => setLoading(false));
  }, [fetchRoom]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRoom();
    setRenderKey((k) => k + 1);
    setRefreshing(false);
  };

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

  const applyZoom = (factor: number) => {
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
  };

  const handlePanStart = (e: React.MouseEvent | React.Touch) => {
    setIsPanning(true);
    lastPanRef.current = { x: e.clientX, y: e.clientY };
  };
  const handlePanMove = (e: React.MouseEvent | React.Touch) => {
    if (!isPanning) return;
    const dx = e.clientX - lastPanRef.current.x;
    const dy = e.clientY - lastPanRef.current.y;
    lastPanRef.current = { x: e.clientX, y: e.clientY };
    setViewTransform((prev) => ({ ...prev, tx: prev.tx + dx, ty: prev.ty + dy }));
  };
  const handlePanEnd = () => setIsPanning(false);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/80 px-8 py-6 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-t-gray-800 border-gray-200 rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-700">Loading…</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/80 px-8 py-6 flex flex-col items-center gap-4 max-w-sm w-full mx-4 text-center">
          <p className="text-sm font-semibold text-gray-800">
            {error || "Something went wrong"}
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden select-none bg-white"
    >
      <Canvas
        key={renderKey}
        roomId={room.id.toString()}
        socket={null}
        selectedTool="select"
        strokeColor="#1e1e1e"
        strokeWidth={2}
        eraserSize={10}
        viewTransform={viewTransform}
        initialStrokes={room.canvasState ?? undefined}
      />

      {/* Pan overlay — this page is always in "select/pan" mode, never draws */}
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

      {/* Top Bar */}
      <header className="absolute top-3 left-0 right-0 flex items-center justify-between px-2 sm:px-3 pointer-events-none z-10 gap-1 sm:gap-2">
        <button
          onClick={() => router.push("/")}
          className="pointer-events-auto flex items-center gap-1.5 h-9 px-2.5 sm:px-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/80 text-sm font-medium text-gray-700 hover:bg-white active:scale-95 transition-all flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Home</span>
        </button>

        <div className="pointer-events-auto h-9 px-2.5 sm:px-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/80 flex items-center gap-2 min-w-0">
          <Eye className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-800 max-w-[90px] sm:max-w-[160px] truncate">
            {room.slug}
          </span>
          <span className="text-xs text-gray-400 hidden sm:inline">
            (view only)
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/80 text-sm font-medium text-gray-700 hover:bg-white active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => router.push("/signin")}
            className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 bg-gray-900 text-white rounded-xl shadow-sm text-sm font-medium hover:bg-gray-700 active:scale-95 transition-all"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign in to edit</span>
          </button>
        </div>
      </header>

      {/* Zoom Controls */}
      <div className="absolute bottom-6 right-2 sm:right-4 z-10">
        <div className="flex items-center gap-0.5 bg-white/95 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/80 p-1">
          <button
            onClick={() => applyZoom(0.95)}
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-90 rounded-lg transition-all"
            title="Zoom out"
          >
            <ZoomOut size={13} />
          </button>
          <span className="text-xs font-medium text-gray-600 w-12 text-center tabular-nums">
            {Math.round(viewTransform.scale * 100)}%
          </span>
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
