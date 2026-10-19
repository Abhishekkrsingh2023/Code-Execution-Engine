import axios from "axios";
import { API_URL } from "./config";

// Create custom Axios client with credentials (cookies) enabled by default
export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor: attach token from localStorage if available
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("code_zero_token");
      if (token && !config.headers["Authorization"]) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: extract response.data and handle 401 refresh
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // Check if 401 Unauthorized
    const isAuthRoute =
      originalRequest.url?.includes("/login") ||
      originalRequest.url?.includes("/register") ||
      originalRequest.url?.includes("/refresh");

    if (status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (typeof window === "undefined") {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(
          `${API_URL}/api-v1/users/refresh`,
          {},
          { withCredentials: true }
        );
        processQueue(null);
        isRefreshing = false;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        localStorage.removeItem("code_zero_user");
        localStorage.removeItem("code_zero_token");

        if (
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith("/login")
        ) {
          window.location.href = "/login";
        }

        const customErr = new Error("Session expired. Please log in again.");
        customErr.status = 401;
        return Promise.reject(customErr);
      }
    }

    // Format error message cleanly
    let errorMsg = "An unexpected error occurred.";
    const respData = error.response?.data;

    if (respData) {
      if (typeof respData.detail === "string") {
        errorMsg = respData.detail;
      } else if (Array.isArray(respData.detail)) {
        errorMsg = respData.detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
      } else if (respData.message) {
        errorMsg = respData.message;
      }
    } else if (error.message) {
      errorMsg = error.message;
    }

    const formattedError = new Error(errorMsg);
    formattedError.status = status || 500;
    formattedError.data = respData;
    return Promise.reject(formattedError);
  }
);

export const api = {
  get: (url, config = {}) => apiClient.get(url, config),
  post: (url, data = {}, config = {}) => apiClient.post(url, data, config),
  patch: (url, data = {}, config = {}) => apiClient.patch(url, data, config),
  delete: (url, config = {}) => apiClient.delete(url, config),
};

export default api;
