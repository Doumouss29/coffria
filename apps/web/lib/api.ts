const base = process.env.NEXT_PUBLIC_API_URL;

if (!base) {
  throw new Error('NEXT_PUBLIC_API_URL is not defined');
}

export async function api(
  path: string,
  init: RequestInit = {},
) {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('coffria_token')
      : null;

  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
