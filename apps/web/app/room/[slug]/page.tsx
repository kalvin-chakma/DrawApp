"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { RoomCanvas } from "../../../components/roomCanvas";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function RoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();

  // Unwrap the params Promise using React.use()
  const { slug } = use(params);

  useEffect(() => {
    // Check for token
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      router.push("/signin");
      return;
    }
    setToken(storedToken);

    // Fetch room details
    fetchRoom();
  }, [slug, router]);

  const fetchRoom = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/room/${slug}`);
      const data = await response.json();

      if (response.ok) {
        setRoom(data);
      } else {
        setError(data.message || "Room not found");
      }
    } catch (err) {
      setError("Failed to fetch room details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-lg">Loading room...</div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={() => router.push("/create-room")}
            className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
          >
            Back to Room Management
          </button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div>Please sign in to access this room</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Room: {room.slug}</h1>
            <p className="text-sm text-gray-600">Room ID: {room.id}</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => router.push("/create-room")}
              className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
            >
              Leave Room
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Collaborative Canvas</h2>
          <RoomCanvas roomId={room.id.toString()} token={token} />
        </div>
      </main>
    </div>
  );
}
