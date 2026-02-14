import { API_ORIGIN } from "./config";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

export async function getCsrfToken(): Promise<string> {
  const data = await apiFetch<{ csrfToken: string }>("/security/csrf", { method: "GET" });
  return data.csrfToken;
}
