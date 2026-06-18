import axios from "axios";

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

// Room APIs
export const createRoom = (data: { name: string }) =>
  apiClient.post("/room", data);

export const getUserRooms = () => apiClient.get("/room/user/rooms");

export const getDashboardStats = () => apiClient.get("/room/stats");

export const getRoomBySlug = (slug: string) => apiClient.get(`/room/${slug}`);
