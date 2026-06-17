import { trpc } from "../../../src/lib/trpc";

export function useAuth() {
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  return {
    user: user ?? undefined,
    isLoading,
  };
}
