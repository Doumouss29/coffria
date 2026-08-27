const base = process.env.NEXT_PUBLIC_API_URL;

if (!base) {
  throw new Error('NEXT_PUBLIC_API_URL is not defined');
}

export async function api(
  path: string,
  init: RequestInit = {},
) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));

    throw new Error(error.message || 'Erreur API');
  }

  return response.json();
}
