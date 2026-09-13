import { useAuthStore } from '@/stores/authStore'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** ASP.NET default JSON is camelCase */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = useAuthStore.getState().token
  const headers = new Headers(options.headers)

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers,
    })
  } catch {
    throw new ApiError(0, 'Falha de rede — API indisponível.')
  }

  if (!res.ok) {
    let msg = res.statusText
    try {
      const body = await res.json()
      msg = body?.message ?? body?.title ?? msg
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
