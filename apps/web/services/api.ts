import axios from "axios";
import type { Stroke } from "../app/draw/types";

export const API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const apiClient = axios.create({
  baseURL: API,
});

// Add Authorization header if token exists
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth APIs
export const signin = (credentials: { username: string; password: string }) =>
  apiClient.post("/auth/signin", credentials);
export const signup = (credentials: {
  username: string;
  name: string;
  password: string;
}) => apiClient.post("/auth/signup", credentials);

export const getCurrentUser = () => apiClient.get("/auth/me");

export const updateProfile = (data: { name: string; photo?: string }) =>
  apiClient.put("/auth/me", data);

export const changePassword = (data: {
  currentPassword: string;
  newPassword: string;
}) => apiClient.put("/auth/password", data);

export const deleteAccount = () => apiClient.delete("/auth/me");

// Room APIs
export const createRoom = (data: { name: string }) =>
  apiClient.post("/room", data);

export const getUserRooms = () => apiClient.get("/room/user/rooms");

export const getDashboardStats = () => apiClient.get("/room/stats");

export const getRoomBySlug = (slug: string) => apiClient.get(`/room/${slug}`);

export const getRoomByViewToken = (viewToken: string) =>
  apiClient.get(`/room/view/${viewToken}`);

export const deleteRoom = (id: number) => apiClient.delete(`/room/${id}`);

export const saveCanvas = (roomId: number, strokes: Stroke[]) =>
  apiClient.put(`/room/${roomId}/canvas`, { strokes });
