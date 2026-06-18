"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import { X, DoorOpen, Search, AlertCircle } from "lucide-react";
import { getRoomBySlug } from "../../services/api";
import { cn } from "@repo/ui/lib/utils";

interface JoinRoomModalProps {
  open: boolean;
  onClose: () => void;
}

export function JoinRoomModal({ open, onClose }: JoinRoomModalProps) {
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setSlug("");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = slug.trim();
    if (!trimmed) {
      setError("Please enter a room name.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await getRoomBySlug(trimmed);
      onClose();
      router.push(`/room/${trimmed}`);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        setError("Room not found. Check the name and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <DoorOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Join a Room
              </h2>
              <p className="text-xs text-gray-500">Enter a room name to join</p>
            </div>
          </div>
          <Button
            variant="fam"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                if (error) setError("");
              }}
              placeholder="e.g. design-review"
              className={cn(
                "w-full pl-10 pr-4 py-3 rounded-xl border text-sm transition-colors outline-none",
                error
                  ? "border-red-300 bg-red-50"
                  : "border-gray-200 bg-gray-50 focus:bg-white",
              )}
              disabled={loading}
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="fam"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-600"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gradient"
              disabled={loading || !slug.trim()}
              className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium"
            >
              {loading ? "Joining..." : "Join Room"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
