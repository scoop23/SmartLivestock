import { isAxiosError } from "axios";

interface ApiErrorBody {
  error?: string;
  detail?: string;
  weight?: string[];
  calving_date?: string[];
  non_field_errors?: string[];
  tag_number?: string[];
  animals?: string[];
  [field: string]: unknown;
}

/** Narrow an unknown failure before reading the backend's error response. */
export function httpError(error: unknown) {
  return isAxiosError<ApiErrorBody>(error) ? error : undefined;
}
