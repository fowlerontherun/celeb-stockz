const authBaseUrl = process.env.NEON_AUTH_BASE_URL!;

export type Session = {
  user: { id: string; name: string; email: string; emailVerified: boolean };
} | null;

export async function getSessionFromCookie(cookieHeader: string | null): Promise<Session> {
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .replaceAll("__Secure_", "__Secure-")
    .replaceAll("__Host_", "__Host-");
  const response = await fetch(`${authBaseUrl}/get-session`, { headers: { cookie } });
  if (!response.ok) return null;

  const session = (await response.json()) as Session;
  return session?.user ? session : null;
}
