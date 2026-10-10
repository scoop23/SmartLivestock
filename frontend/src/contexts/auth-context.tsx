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
  profileImage?: string | null;
  phoneNumber?: string | null;
  barangay?: string | null;
  assignedBarangayId?: number | null;
  assignedBarangayName?: string | null;
  accessScope?: "ASSIGNED_ONLY" | "ALL_BARANGAYS";
  farmerId?: number | null;
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
  updateUser: (updatedFields: Partial<User>) => void;
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
        ...prev,
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
      const latestToken =
        typeof window !== "undefined" ? localStorage.getItem("access") : token;

      setUser({
        firstName: data.first_name || null,
        lastName: data.last_name || null,
        email: data.email,
        role: data.role,
        profileImage: data.profile_image || null,
        phoneNumber: data.phone_number || null,
        barangay: data.barangay || null,
        assignedBarangayId: data.assigned_barangay_id ?? null,
        assignedBarangayName: data.assigned_barangay_name ?? null,
        accessScope: data.access_scope ?? "ASSIGNED_ONLY",
        farmerId: data.farmer_id ?? null,
      });
      setAccessToken(latestToken);
    } catch (error: any) {
      if (error?.response?.status === 401) {
        console.warn("Session expired. Clearing invalid token.");
        setUser(null);
        setAccessToken(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("access");
          localStorage.removeItem("refresh");
        }
      } else {
        // Transient network error or temporary server error: maintain session from decoded JWT
        try {
          const currentToken =
            typeof window !== "undefined" ? localStorage.getItem("access") : token;
          if (currentToken) {
            const decoded = jwtDecode<DecodedToken>(currentToken);
            if (!decoded.exp || decoded.exp * 1000 > Date.now()) {
              setUser((prev) => ({
                ...prev,
                firstName: prev?.firstName || null,
                lastName: prev?.lastName || null,
                email: decoded.email || prev?.email || null,
                role: decoded.role || prev?.role || null,
                profileImage: prev?.profileImage || null,
                phoneNumber: prev?.phoneNumber || null,
              }));
              setAccessToken(currentToken);
            }
          }
        } catch {
          // ignore
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateUser = useCallback((updatedFields: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updatedFields } : null));
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      window.location.replace("/login");
    }
    setUser(null);
    setAccessToken(null);
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, isLoading, fetchUser, logout, updateUser }}
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
