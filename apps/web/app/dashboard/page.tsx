"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  DoorOpen,
  Plus,
  ArrowRight,
  AlertCircle,
  Clock,
  Pencil,
} from "lucide-react";
import {
  getDashboardStats,
  getUserRooms,
  getCurrentUser,
} from "../../services/api";
import {
  StatCard,
  StatCardSkeleton,
} from "../../components/dashboard/stat-card";
import { JoinRoomModal } from "../../components/dashboard/join-room-modal";
import { Button } from "@repo/ui/components/button";

interface Stats {
  totalRooms: number;
  totalNotes: number;
}

interface Room {
  id: number;
  slug: string;
  createdAt: string;
  adminId: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [roomsError, setRoomsError] = useState("");
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [username, setUsername] = useState("");
  const router = useRouter();

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError("");
    try {
      const res = await getDashboardStats();
      setStats(res.data);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        router.push("/signin");
        return;
      }
      setStatsError("Failed to load statistics.");
    } finally {
      setLoadingStats(false);
    }
  }, [router]);

  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    setRoomsError("");
    try {
      const res = await getUserRooms();
      setRooms(res.data.rooms);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        router.push("/signin");
        return;
      }
      setRoomsError("Failed to load rooms.");
    } finally {
      setLoadingRooms(false);
    }
  }, [router]);

  const fetchUser = useCallback(async () => {
    try {
      const res = await getCurrentUser();
      setUsername(res.data.name);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        router.push("/signin");
      }
    }
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/signin");
      return;
    }
    fetchUser();
    fetchStats();
    fetchRooms();
  }, [fetchStats, fetchRooms, fetchUser, router]);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4" />
            <h1 className="text-md font-semibold">Dashboard</h1>
          </div>
          <p className="text-2xl text-black font-bold mt-0.5">
            Welcome back{username ? `, ${username}` : ""}
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
            onClick={() => router.push("/create-room")}
          >
            New Room
          </Button>
        </div>
      </div>

      {/* Stats */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Overview
        </h2>

        {statsError ? (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{statsError}</span>
            <Button
              variant="fam"
              icon="RefreshCw"
              className="ml-auto text-red-500 hover:text-red-700 font-medium"
              onClick={fetchStats}
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loadingStats ? (
              <StatCardSkeleton />
            ) : (
              <StatCard
                title="Total Rooms"
                value={stats?.totalRooms ?? 0}
                icon={DoorOpen}
                description="Rooms you've created"
                className="text-black"
                iconBg="bg-white/20"
              />
            )}
          </div>
        )}
      </section>

      {/* Rooms */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Recent Rooms
          </h2>

          <Button
            variant="fam"
            icon="ArrowRight"
            className="text-xs text-gray-600 hover:text-gray-800 font-medium"
            onClick={() => router.push("/dashboard/rooms")}
          >
            View all
          </Button>
        </div>

        {roomsError ? (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{roomsError}</span>
            <Button
              variant="fam"
              icon="RefreshCw"
              className="ml-auto text-red-500 hover:text-red-700 font-medium"
              onClick={fetchRooms}
            >
              Retry
            </Button>
          </div>
        ) : loadingRooms ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-16 bg-gray-100 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 text-center">
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
              onClick={() => router.push("/create-room")}
            >
              Create a Room
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.slice(0, 5).map((room) => (
              <button
                key={room.id}
                onClick={() => router.push(`/room/${room.slug}`)}
                className="flex items-center w-full bg-white rounded-xl border border-gray-100 px-5 py-4 hover:border-gray-300 hover:shadow-sm transition-all group text-left"
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

                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Quick Actions
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <QuickActionCard
            icon={Plus}
            label="Create Room"
            description="Start a new collaborative canvas"
            onClick={() => router.push("/create-room")}
            color="slate"
          />
          <QuickActionCard
            icon={DoorOpen}
            label="Join Room"
            description="Enter an existing room by name"
            onClick={() => setJoinModalOpen(true)}
            color="zinc"
          />
        </div>
      </section>

      {/* Modal */}
      <JoinRoomModal
        open={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
      />
    </div>
  );
}

// ─── Quick Action Card ────────────────────────────────────────────────────────

interface QuickActionCardProps {
  icon: React.ElementType;
  label: string;
  description: string;
  onClick: () => void;
  color: "slate" | "zinc" | "stone";
}

const colorMap = {
  slate: {
    bg: "bg-slate-50 hover:bg-slate-100",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    text: "text-slate-700",
  },
  zinc: {
    bg: "bg-zinc-50 hover:bg-zinc-100",
    iconBg: "bg-zinc-100",
    iconColor: "text-zinc-600",
    text: "text-zinc-700",
  },
  stone: {
    bg: "bg-stone-50 hover:bg-stone-100",
    iconBg: "bg-stone-100",
    iconColor: "text-stone-600",
    text: "text-stone-700",
  },
};

function QuickActionCard({
  icon: Icon,
  label,
  description,
  onClick,
  color,
}: QuickActionCardProps) {
  const c = colorMap[color];
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 p-4 rounded-xl border border-transparent hover:border-gray-200 transition-all text-left group ${c.bg}`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.iconBg}`}
      >
        <Icon className={`w-5 h-5 ${c.iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${c.text}`}>{label}</p>
        <p className="text-xs text-gray-500 truncate">{description}</p>
      </div>
    </button>
  );
}
