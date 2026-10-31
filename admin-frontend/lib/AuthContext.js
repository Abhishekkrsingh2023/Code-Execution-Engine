"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

const AuthContext = createContext({
  user: null,
  loading: true,
  isAdmin: false,
  isModerator: false,
  isStaff: false,
  login: async () => {},
  loginWithOtp: async () => {},
  requestOtp: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const validateStaffRole = (userData) => {
    if (!userData) return false;
    return userData.role === "admin" || userData.role === "moderator";
  };

  // Load and verify session on mount
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      // Optimistic instant hydration from localStorage
      const cached = localStorage.getItem("code_zero_admin_user");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (validateStaffRole(parsed)) {
            setUser(parsed);
          } else {
            localStorage.removeItem("code_zero_admin_user");
            localStorage.removeItem("code_zero_admin_token");
          }
        } catch {
          localStorage.removeItem("code_zero_admin_user");
        }
      }

      // Verify active session with backend /api-v1/users/me
      try {
        const freshUser = await api.get("/api-v1/users/me");
        if (mounted && freshUser) {
          if (validateStaffRole(freshUser)) {
            setUser(freshUser);
            localStorage.setItem("code_zero_admin_user", JSON.stringify(freshUser));
          } else {
            // Not admin or moderator
            setUser(null);
            localStorage.removeItem("code_zero_admin_user");
            localStorage.removeItem("code_zero_admin_token");
          }
        }
      } catch (err) {
        if (mounted && err.status === 401) {
          setUser(null);
          localStorage.removeItem("code_zero_admin_user");
          localStorage.removeItem("code_zero_admin_token");
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

    const loggedUser = res?.user;
    if (!loggedUser) {
      throw new Error("No user profile returned from login service.");
    }

    if (!validateStaffRole(loggedUser)) {
      // Immediately revoke cookie/session since regular users cannot enter
      try {
        await api.post("/api-v1/users/logout");
      } catch {
        // ignore
      }
      localStorage.removeItem("code_zero_admin_user");
      localStorage.removeItem("code_zero_admin_token");
      throw new Error(
        `Access Denied: Account '${loggedUser.username}' has role '${loggedUser.role}'. Only Admin and Moderator roles can access this portal.`
      );
    }

    setUser(loggedUser);
    localStorage.setItem("code_zero_admin_user", JSON.stringify(loggedUser));
    return res;
  };

  const loginWithOtp = async (email, otp) => {
    const res = await api.post("/api-v1/users/otp/verify", {
      email,
      otp,
    });

    const loggedUser = res?.user;
    if (!loggedUser) {
      throw new Error("No user profile returned from login service.");
    }

    if (!validateStaffRole(loggedUser)) {
      try {
        await api.post("/api-v1/users/logout");
      } catch {
        // ignore
      }
      localStorage.removeItem("code_zero_admin_user");
      localStorage.removeItem("code_zero_admin_token");
      throw new Error(
        `Access Denied: Account '${loggedUser.username}' has role '${loggedUser.role}'. Only Admin and Moderator roles can access this portal.`
      );
    }

    setUser(loggedUser);
    localStorage.setItem("code_zero_admin_user", JSON.stringify(loggedUser));
    return res;
  };

  const requestOtp = async (email) => {
    return await api.post("/api-v1/users/otp/request", { email });
  };

  const logout = async () => {
    try {
      await api.post("/api-v1/users/logout");
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      localStorage.removeItem("code_zero_admin_user");
      localStorage.removeItem("code_zero_admin_token");
      router.push("/login");
    }
  };

  const refreshUser = async () => {
    try {
      const freshUser = await api.get("/api-v1/users/me");
      if (validateStaffRole(freshUser)) {
        setUser(freshUser);
        localStorage.setItem("code_zero_admin_user", JSON.stringify(freshUser));
        return freshUser;
      } else {
        await logout();
        return null;
      }
    } catch {
      return null;
    }
  };

  const isAdmin = user?.role === "admin";
  const isModerator = user?.role === "moderator";
  const isStaff = isAdmin || isModerator;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        isModerator,
        isStaff,
        login,
        loginWithOtp,
        requestOtp,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
