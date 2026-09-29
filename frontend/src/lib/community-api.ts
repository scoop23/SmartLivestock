import api from "@/lib/axios";

export type Activity = {
  id: number; title: string; content: string; category: string;
  audience: "ALL" | "FARMER" | "SIBAT"; is_published: boolean;
  is_pinned: boolean; author: string; published_at: string | null; created_at: string;
};
export type ProgramSchedule = {
  id: number; date: string; program: string; is_open: boolean;
  booked_times: string[]; created_at: string;
};
export type ProgramBooking = {
  id: number; schedule: number; farmer_name: string; date: string;
  program: string; time: string; status: "CONFIRMED" | "CANCELLED"; created_at: string;
};
export const getActivities = async () => (await api.get<Activity[]>("/community/announcements/")).data;
export const getSchedules = async () => (await api.get<ProgramSchedule[]>("/community/schedules/")).data;
export const getBookings = async () => (await api.get<ProgramBooking[]>("/community/bookings/")).data;
export function apiError(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string; non_field_errors?: string[] } } }).response;
    return response?.data?.detail || response?.data?.non_field_errors?.[0] || "Please check your entries and try again.";
  }
  return "Could not connect to the server. Please try again.";
}
