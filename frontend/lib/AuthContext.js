"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

const AuthContext = createContext({
  user: null,
  loading: true,
  login: async () => {},
  loginWithOtp: async () => {},
  register: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load and verify session on mount
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      // Optimistic instant hydration from localStorage
      const cached = localStorage.getItem("code_zero_user");
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch {
          localStorage.removeItem("code_zero_user");
        }
      }

      // Verify active session with backend /api-v1/users/me
      try {
        const freshUser = await api.get("/api-v1/users/me");
        if (mounted && freshUser) {
          setUser(freshUser);
          localStorage.setItem("code_zero_user", JSON.stringify(freshUser));
        }
      } catch (err) {
        if (mounted && err.status === 401) {
          setUser(null);
          localStorage.removeItem("code_zero_user");
          localStorage.removeItem("code_zero_token");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (username_or_email, password) => {
    const res = await api.post("/api-v1/users/login", {
      username_or_email,
      password,
    });

    if (res?.user) {
      setUser(res.user);
      localStorage.setItem("code_zero_user", JSON.stringify(res.user));
    }
    return res;
  };

  const loginWithOtp = async (email, otp) => {
    const res = await api.post("/api-v1/users/otp/verify", {
      email,
      otp,
    });

    if (res?.user) {
      setUser(res.user);
      localStorage.setItem("code_zero_user", JSON.stringify(res.user));
    }
    return res;
  };

  const register = async (username, email, password) => {
    const payload = { username, email };
    if (password) payload.password = password;
    return await api.post("/api-v1/users/register", payload);
  };

  const logout = async () => {
    try {
      await api.post("/api-v1/users/logout");
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      localStorage.removeItem("code_zero_user");
      localStorage.removeItem("code_zero_token");
      router.push("/login");
    }
  };

  const refreshUser = async () => {
    try {
      const freshUser = await api.get("/api-v1/users/me");
      setUser(freshUser);
      localStorage.setItem("code_zero_user", JSON.stringify(freshUser));
      return freshUser;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithOtp,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
