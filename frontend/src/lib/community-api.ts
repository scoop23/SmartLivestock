import api from "@/lib/axios";

// Shared announcements/scheduling client. Auction uses getActivities() to read
// notices; audience filtering and publishing permissions are decided by Django.

export type ScheduleStatus = "AVAILABLE" | "FULL" | "CLOSED" | "COMPLETED";

export type ProgramSchedule = {
  id: number;
  date: string;
  program: string;
  location: string;
  is_open: boolean;
  booked_times: string[];
  booking_count: number;
  capacity: number;
  remaining_slots: number;
  registration_status: ScheduleStatus;
  created_at: string;
};

export type ActivityPhoto = { id: number; image: string; position: number };

export type AnnouncementAudience =
  | "FARMER_AND_SIBAT"
  | "FARMER_ONLY"
  | "SIBAT_ONLY"
  | "ALL"
  | "SIBAT_BARANGAY"
  | "FARMER"
  | "SIBAT";

export type Activity = {
  id: number;
  title: string;
  content: string;
  image: string | null;
  photos: ActivityPhoto[];
  category: string;
  audience: AnnouncementAudience;
  target_barangay?: number | null;
  target_barangay_id?: string | number | null;
  target_barangay_name?: string | null;
  is_published: boolean;
  is_pinned: boolean;
  author: string;
  schedule: ProgramSchedule | null;
  published_at: string | null;
  created_at: string;
};

export type BarangayOption = {
  id: number;
  barangay_name: string;
};

export type ProgramBooking = {
  id: number;
  schedule: number;
  farmer_name: string;
  farmer_barangay: string | null;
  date: string;
  program: string;
  time: string;
  status: "CONFIRMED" | "CANCELLED";
  created_at: string;
};

export const getActivities = async () =>
  (await api.get<Activity[]>("/community/announcements/")).data;
export const getSchedules = async () =>
  (await api.get<ProgramSchedule[]>("/community/schedules/")).data;
export const getBookings = async () =>
  (await api.get<ProgramBooking[]>("/community/bookings/")).data;
export const getBarangays = async () =>
  (await api.get<BarangayOption[]>("/livestock/barangays/")).data;

export function apiError(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    ("code" in error && (error as { code?: string }).code === "ERR_CANCELED")
  ) {
    return "Request was cancelled.";
  }

  if (error && typeof error === "object" && "isAxiosError" in error) {
    const axiosErr = error as {
      config?: { url?: string; method?: string; baseURL?: string };
      response?: { status?: number; data?: Record<string, unknown> };
      code?: string;
      message?: string;
    };

    if (process.env.NODE_ENV !== "production") {
      console.error("[SmartLivestock API Error]", {
        url: axiosErr.config?.url,
        method: axiosErr.config?.method?.toUpperCase(),
        baseURL: axiosErr.config?.baseURL,
        status: axiosErr.response?.status,
        code: axiosErr.code,
        message: axiosErr.message,
        data: axiosErr.response?.data,
      });
    }

    const data = axiosErr.response?.data;
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.non_field_errors) && typeof data.non_field_errors[0] === "string") {
      return data.non_field_errors[0];
    }
    const fieldError = Object.values(data ?? {}).find(
      (value) => Array.isArray(value) && typeof value[0] === "string"
    );
    if (Array.isArray(fieldError)) return fieldError[0] as string;

    if (axiosErr.response?.status === 401) return "Session expired. Please log in again.";
    if (axiosErr.response?.status === 403) return "You do not have permission for this action.";
    if (axiosErr.response?.status === 404) return "The requested record was not found.";
    if (axiosErr.response?.status && axiosErr.response.status >= 500) {
      return "Server error occurred. Please try again shortly.";
    }
    if (axiosErr.code === "ECONNABORTED") {
      return "The request timed out. Please try again.";
    }
  }

  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { data?: Record<string, unknown> } }).response;
    const data = response?.data;
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.non_field_errors) && typeof data.non_field_errors[0] === "string") return data.non_field_errors[0];
    const fieldError = Object.values(data ?? {}).find((value) => Array.isArray(value) && typeof value[0] === "string");
    if (Array.isArray(fieldError)) return fieldError[0] as string;
    return "Please check your entries and try again.";
  }
  return "Could not connect to the server. Please try again.";
}
