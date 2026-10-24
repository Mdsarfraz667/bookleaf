import axios, { AxiosError } from "axios";
import type { ApiError } from "./types";

export const TOKEN_KEY = "bookleaf_token";
export const USER_KEY = "bookleaf_user";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const api = axios.create({ baseURL });

// Attach the Bearer token (if any) to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear the session and bounce to /login (unless already there).
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

/** Pull a friendly message out of an axios error using the API's { error } shape. */
export function errorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined;
    if (data?.error) return data.error;
    if (error.message) return error.message;
  }
  return fallback;
}
