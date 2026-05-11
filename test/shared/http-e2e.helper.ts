export interface HttpJsonResponse<T = unknown> {
  status: number;
  body: T;
}

export async function getJson<T = Record<string, unknown>>(
  url: string,
): Promise<HttpJsonResponse<T>> {
  return requestJson<T>(url);
}

export async function postJson<T = Record<string, unknown>>(
  url: string,
  body: unknown,
  token?: string,
): Promise<HttpJsonResponse<T>> {
  return requestJson<T>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

export async function postGraphql<T = unknown>(
  url: string,
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const response = await postJson<T>(
    url,
    { query, variables },
    token,
  );
  return response.body;
}

export async function requestOk(url: string): Promise<boolean> {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

async function requestJson<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<HttpJsonResponse<T>> {
  const response = await fetch(url, init);
  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;

  return {
    status: response.status,
    body,
  };
}
