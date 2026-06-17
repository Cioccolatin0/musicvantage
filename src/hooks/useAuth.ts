import { trpc } from "../lib/trpc";

const AUTH_CACHE_KEY = "musicstream_user";

export function getCachedUser(): { id: number; email: string; name: string } | null {
  try {
    const cached = sessionStorage.getItem(AUTH_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user: { id: number; email: string; name: string } | null) {
  if (user) {
    sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
  } else {
    sessionStorage.removeItem(AUTH_CACHE_KEY);
  }
}

export function useAuth() {
  const cached = getCachedUser();
  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, {
    staleTime: 30 * 1000,
  });

  const hasServerConfirmed = user !== undefined;
  const resolvedUser = (hasServerConfirmed ? user : cached) ?? undefined;

  if (hasServerConfirmed && !user && cached) {
    sessionStorage.removeItem("musicstream_user");
  } else if (hasServerConfirmed && user) {
    sessionStorage.setItem("musicstream_user", JSON.stringify(user));
  }

  return {
    user: resolvedUser,
    isLoading: isLoading && !cached,
  };
}
