// Toutes les routes vivent sous `/api` : servies par le back en production, par le proxy Vite en dev.
export const API = '/api'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const request = async <T = void>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> => {
  const { json, ...rest } = init
  const response = await fetch(`${API}${path}`, {
    ...rest,
    ...(json !== undefined && {
      body: JSON.stringify(json),
      headers: { 'Content-Type': 'application/json', ...rest.headers },
    }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(
      response.status,
      body.message ?? `Erreur ${response.status}`,
    )
  }
  return (response.status === 204 ? undefined : await response.json()) as T
}

export const pathQuery = (path: string) => `path=${encodeURIComponent(path)}`
