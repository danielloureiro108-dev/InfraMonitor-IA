const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getToken(): string | null {
  return localStorage.getItem("inframonitor_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const resp = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (resp.status === 401) {
    localStorage.removeItem("inframonitor_token");
    localStorage.removeItem("inframonitor_usuario");
    window.location.href = "/login";
    throw new Error("Sessão expirada");
  }

  if (!resp.ok) {
    const corpo = await resp.json().catch(() => ({}));
    throw new Error(corpo.erro || `Erro na requisição (HTTP ${resp.status})`);
  }

  if (resp.status === 204) return undefined as unknown as T;
  return resp.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: any) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body?: any) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: any) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  baseUrl: BASE_URL,
};
