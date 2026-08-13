"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DoorOpen,
  ArrowRight,
  AlertCircle,
  Clock,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { getUserRooms, deleteRoom } from "../../../services/api";
import { JoinRoomModal } from "../../../components/dashboard/join-room-modal";
import { CreateRoomModal } from "../../../components/dashboard/create-room-model";
import { Button } from "@repo/ui/components/button";

interface Room {
  id: number;
  slug: string;
  createdAt: string;
  adminId: string;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getUserRooms();
      setRooms(res.data.rooms);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        router.push("/signin");
        return;
      }
      setError("Failed to load rooms.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/signin");
      return;
    }
    fetchRooms();
  }, [fetchRooms, router]);

  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((room) => room.slug.toLowerCase().includes(q));
  }, [rooms, query]);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleDelete = async () => {
    if (!roomToDelete) return;
    setDeleting(true);
    try {
      await deleteRoom(roomToDelete.id);
      setRooms((prev) => prev.filter((r) => r.id !== roomToDelete.id));
      setRoomToDelete(null);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        router.push("/signin");
        return;
      }
      setError("Failed to delete room. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <DoorOpen className="w-4 h-4" />
            <h1 className="text-md font-semibold">Rooms</h1>
          </div>
          <p className="text-2xl text-black font-bold mt-0.5">
            All your rooms
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="fam"
            icon="DoorOpen"
            className="px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium bg-gray-50 hover:bg-gray-100"
            onClick={() => setJoinModalOpen(true)}
          >
            Join Room
          </Button>

          <Button
            variant="gradient"
            icon="Plus"
            className="px-4 py-2.5 text-sm font-medium"
            onClick={() => setCreateModalOpen(true)}
          >
            New Room
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search rooms..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-gray-300 transition-colors"
        />
      </div>

      {/* Rooms list */}
      {error ? (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <Button
            variant="fam"
            icon="RefreshCw"
            className="ml-auto text-red-500 hover:text-red-700 font-medium"
            onClick={fetchRooms}
          >
            Retry
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
            <Pencil className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-600">No rooms yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">
            Create your first room to start collaborating
          </p>
          <Button
            variant="gradient"
            icon="Plus"
            className="px-4 py-2 rounded-lg text-xs font-medium"
            onClick={() => setCreateModalOpen(true)}
          >
            Create a Room
          </Button>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 text-center">
          <p className="text-sm font-medium text-gray-600">
            No rooms match &quot;{query}&quot;
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRooms.map((room) => (
            <div
              key={room.id}
              className="flex items-center w-full bg-white rounded-xl border border-gray-100 px-5 py-4 hover:border-gray-300 hover:shadow-sm transition-all group"
            >
              <button
                onClick={() => router.push(`/room/${room.slug}`)}
                className="flex items-center flex-1 min-w-0 text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-gray-200 transition-colors">
                  <DoorOpen className="w-4.5 h-4.5 text-gray-500" size={18} />
                </div>

                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {room.slug}
                  </p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {formatDate(room.createdAt)}
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="fam"
                  size="icon"
                  aria-label={`Delete ${room.slug}`}
                  className="text-gray-300 hover:text-red-500"
                  onClick={() => setRoomToDelete(room)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <ArrowRight
                  className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors cursor-pointer"
                  onClick={() => router.push(`/room/${room.slug}`)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <JoinRoomModal
        open={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
      />
      <CreateRoomModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      {/* Delete confirmation */}
      {roomToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !deleting && setRoomToDelete(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Delete room
                  </h2>
                  <p className="text-xs text-gray-500">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <Button
                variant="fam"
                size="icon"
                aria-label="Close"
                className="text-gray-400 hover:text-gray-600"
                onClick={() => !deleting && setRoomToDelete(null)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete{" "}
              <span className="font-medium text-gray-900">
                {roomToDelete.slug}
              </span>
              ? All chats in this room will also be deleted.
            </p>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="fam"
                onClick={() => setRoomToDelete(null)}
                disabled={deleting}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-sm font-medium text-gray-600"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600"
              >
                {deleting ? "Deleting..." : "Delete Room"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
