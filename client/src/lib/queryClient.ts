import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  endpoint: string,
  method: string = "GET",
  body?: any
): Promise<Response> {
  const token = localStorage.getItem("auth_token");

  console.log(`[API Request] ${method} ${endpoint}`, body ? { body } : '');

  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (token) {
    (config.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  } else {
    console.warn(`[API Request] No auth token found for ${method} ${endpoint}`);
  }

  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(endpoint, config);

    console.log(`[API Request] ${method} ${endpoint} -> ${response.status} ${response.statusText}`);

    // For debugging, log response for preferences endpoints
    if (endpoint.includes('preferences')) {
      const responseClone = response.clone();
      const responseText = await responseClone.text();
      console.log(`[API Request] Preferences response:`, responseText);
    }

    return response;
  } catch (error) {
    console.error(`[API Request] Network error for ${method} ${endpoint}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem("auth_token");
    const headers: Record<string, string> = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      // Clear invalid token
      localStorage.removeItem("auth_token");
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});