export class ClientRequestError extends Error {
  constructor(message: string, public status: number, public uncertain = false, public code?: string) {
    super(message)
    this.name = 'ClientRequestError'
  }
}

export async function responseJson(response: Response): Promise<any> {
  let body: any
  try {
    body = await response.json()
  } catch {
    throw new ClientRequestError(
      response.ok ? 'The server response could not be confirmed. Refresh before retrying.' : `Request failed (${response.status}). Please try again.`,
      response.status, response.ok || response.status >= 500,
    )
  }
  if (!response.ok) {
    throw new ClientRequestError(
      typeof body?.error === 'string' ? body.error.slice(0, 300) : `Request failed (${response.status}). Please try again.`,
      response.status, response.status >= 500,
      typeof body?.code === 'string' ? body.code : undefined,
    )
  }
  return body
}

export async function mutationJson(response: Response): Promise<any> {
  const body = await responseJson(response)
  if (body?.success !== true) throw new ClientRequestError('The change could not be confirmed. Reload before retrying.', response.status, true)
  return body
}

// Invalidates an earlier response without requiring the underlying POST to abort.
export function createRequestGuard() {
  let version = 0
  return { next: () => ++version, invalidate: () => { version++ }, isCurrent: (captured: number) => captured === version }
}
