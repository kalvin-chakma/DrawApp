"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { RoomCanvas } from "../../../components/roomCanvas";
import { getRoomBySlug } from "../../../services/api";

interface Room {
  id: number;
  slug: string;
  adminId: string;
  createdAt: string;
}

export default function RoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [room, setRoom] = useState<Room | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      router.push("/signin");
      return;
    }
    setToken(storedToken);

    getRoomBySlug(slug)
      .then((res) => setRoom(res.data))
      .catch((err) => {
        if (err?.response?.status === 401) {
          router.push("/signin");
        } else {
          setError(err?.response?.data?.message || "Room not found");
        }
      })
      .finally(() => setLoading(false));
  }, [slug, router]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/80 px-8 py-6 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-t-gray-800 border-gray-200 rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-700">Loading room…</p>
        </div>
      </div>
    );
  }

  if (error || !room || !token) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/80 px-8 py-6 flex flex-col items-center gap-4 max-w-sm w-full mx-4 text-center">
          <p className="text-sm font-semibold text-gray-800">
            {error || "Something went wrong"}
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <RoomCanvas
      roomId={room.id.toString()}
      roomSlug={room.slug}
      token={token}
    />
  );
}
