"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function CreateRoom() {
  const [roomName, setRoomName] = useState("");
  const [joinRoomSlug, setJoinRoomSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const createRoom = async () => {
    if (!roomName.trim()) {
      setError("Room name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/signin");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ name: roomName }),
      });

      const data = await response.json();

      if (response.ok) {
        // Navigate to the room with the slug (room name)
        router.push(`/room/${roomName}`);
      } else {
        setError(data.message || "Failed to create room");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = () => {
    if (!joinRoomSlug.trim()) {
      setError("Room slug is required");
      return;
    }
    router.push(`/room/${joinRoomSlug}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-8">Room Management</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Create Room Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Create New Room</h2>
          <input
            type="text"
            placeholder="Enter room name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            disabled={loading}
          />
          <button
            onClick={createRoom}
            disabled={loading || !roomName.trim()}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Creating..." : "Create Room"}
          </button>
        </div>

        {/* Join Room Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Join Existing Room</h2>
          <input
            type="text"
            placeholder="Enter room slug"
            value={joinRoomSlug}
            onChange={(e) => setJoinRoomSlug(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
          />
          <button
            onClick={joinRoom}
            disabled={!joinRoomSlug.trim()}
            className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
}
