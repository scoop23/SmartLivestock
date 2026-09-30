import api from "@/lib/axios";

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

export type Activity = {
  id: number;
  title: string;
  content: string;
  image: string | null;
  photos: ActivityPhoto[];
  category: string;
  audience: "ALL" | "FARMER" | "SIBAT";
  is_published: boolean;
  is_pinned: boolean;
  author: string;
  schedule: ProgramSchedule | null;
  published_at: string | null;
  created_at: string;
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

export function apiError(error: unknown): string {
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