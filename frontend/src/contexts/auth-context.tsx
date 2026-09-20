"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { jwtDecode } from "jwt-decode";
import api from "@/lib/axios";

export interface User {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string | null;
}

interface DecodedToken {
  email?: string;
  role?: string;
  exp?: number;
}

interface AuthProviderProps {
  children: ReactNode;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  fetchUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const token = localStorage.getItem("access");
        if (token) {
          const decoded = jwtDecode<DecodedToken>(token);
          // Check expiration if present
          if (!decoded.exp || decoded.exp * 1000 > Date.now()) {
            return {
              firstName: null,
              lastName: null,
              email: decoded.email || null,
              role: decoded.role || null,
            };
          }
        }
      } catch {
        // Ignore decode error on init
      }
    }
    return null;
  });

  const [accessToken, setAccessToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("access");
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUser = useCallback(async () => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("access") : null;

    if (!token) {
      setUser(null);
      setAccessToken(null);
      setIsLoading(false);
      return;
    }

    // Immediately decode token to have synchronous role/email available
    try {
      const decoded = jwtDecode<DecodedToken>(token);
      setUser((prev) => ({
        firstName: prev?.firstName || null,
        lastName: prev?.lastName || null,
        email: decoded.email || prev?.email || null,
        role: decoded.role || prev?.role || null,
      }));
      setAccessToken(token);
    } catch {
      // Ignore token decode error
    }

    try {
      setIsLoading(true);
      const response = await api.get("/api/users/me/");
      const data = response.data;

      setUser({
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email,
        role: data.role,
      });
      setAccessToken(token);
    } catch (error: any) {
      if (error?.response?.status === 401) {
        console.warn("Session expired. Clearing invalid token.");
        setUser(null);
        setAccessToken(null);
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      window.location.href = "/login";
    }
    setUser(null);
    setAccessToken(null);
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, isLoading, fetchUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
