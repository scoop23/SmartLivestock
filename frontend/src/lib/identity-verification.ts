import axios from "axios";
import { getActiveApiUrl } from "@/lib/axios";

export const IDENTITY_TOKEN_KEY = "registration-identity-session";
export interface IdentityConfig {
  enabled: boolean;
  available: boolean;
  provider: string;
  environment: string;
  policy_version: string;
  retention_notice: string;
  privacy_contact: string;
}
export interface IdentityAttempt {
  id: string;
  state: string;
  environment: string;
  document_result: string;
  face_result: string;
  liveness_result: string;
  provider_reference: string | null;
  updated_at: string;
  consent_at: string | null;
  policy_version: string;
  manual_review_at: string | null;
  manual_review_reason: string;
  assessment_current: boolean;
  events: { state: string; created_at: string }[];
}

// Dedicated client: no cloud fallback, token refresh, or sensitive error logging.
export function identityClient(registrationToken?: string) {
  const access = typeof window !== "undefined" ? localStorage.getItem("access") : null;
  return axios.create({
    baseURL: getActiveApiUrl(), timeout: 20000,
    headers: registrationToken ? { Authorization: `Identity ${registrationToken}` }
      : access ? { Authorization: `Bearer ${access}` } : {},
  });
}

export function identityMessage(attempt: IdentityAttempt | null): string {
  if (!attempt || attempt.state === "NOT_STARTED") return "ID uploaded. Face matching and liveness have not been completed.";
  if (attempt.environment === "sandbox") return "Provider sandbox only. No real identity or liveness has been verified. MAO assessment is required.";
  switch (attempt.state) {
    case "COMPLETED": return "The provider completed its checks. This is supporting evidence; MAO must still assess your documents and application.";
    case "REVIEW_REQUIRED": return "The automated result needs human review. This does not mean your registration was rejected. Contact MAO for assistance.";
    case "FAILED_TECHNICAL": return "The verification service could not complete the request. Retry later or ask MAO for manual assessment.";
    case "RETRY_REQUIRED": return "Verification was interrupted or expired. Retry the capture or contact MAO; do not create another registration.";
    default: return "Verification is still processing or capture is incomplete. Finish the provider steps, then check the result.";
  }
}

export function identityError(error: unknown): string {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status === 401) return "Registration session expired. Contact MAO for assistance; do not register again.";
  if (status === 429) return "Too many attempts. Wait before retrying or contact MAO.";
  if (status === 403) return "You are not authorized to access this identity evidence.";
  if (status === 400) return "Check your consent and current privacy notice, then try again.";
  return "Verification is unavailable or interrupted. Retry later or contact MAO. Your registration has not been automatically approved or rejected.";
}

export function providerCaptureUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "verify.didit.me" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Invalid verification destination");
  }
  return url.href;
}
