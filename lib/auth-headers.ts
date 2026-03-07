/**
 * Auth headers utility functions for authenticated API requests.
 */

import { CurrentUser } from "@stackframe/stack";

/**
 * Get authenticated headers with JSON content type.
 * Use for regular API requests with JSON body.
 *
 * @param user - Stack user object with getAccessToken method
 * @returns Headers object with Authorization and Content-Type
 */
export async function getAuthHeaders(
  user: CurrentUser,
  options?: { testMode?: boolean }
): Promise<HeadersInit> {
  const accessToken = await user.getAccessToken();
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  if (options?.testMode) {
    headers["x-test-mode"] = "true";
  }

  return headers;
}

/**
 * Get authenticated headers for FormData requests.
 * Use for file uploads and multipart form data.
 * Note: Don't set Content-Type for FormData - browser sets it with boundary.
 *
 * @param user - Stack user object with getAccessToken method
 * @returns Headers object with Authorization only
 */
export async function getAuthHeadersForFormData(user: CurrentUser): Promise<HeadersInit> {
  const accessToken = await user.getAccessToken();
  return {
    "Authorization": `Bearer ${accessToken}`,
  };
}
