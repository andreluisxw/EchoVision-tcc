export interface Account {
  id: string;
  name: string;
  email: string;
  role: "owner" | "moderator";
  mustChangePassword: boolean;
  active?: boolean;
}
export async function adminApi<T>(
  route: string,
  body?: unknown,
  method = "POST",
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/v1/admin${route}`, {
    credentials: "same-origin",
    signal,
    method: body === undefined ? "GET" : method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event("admin-session-expired"));
    throw new Error(data.message || "Operação indisponível.");
  }
  return data;
}
