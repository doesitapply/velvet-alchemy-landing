import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  // MOCK USER FOR DEVELOPMENT EXPLORATION
  const mockUser = {
    id: 1,
    openId: "dev-user",
    name: "Architect Cameron",
    email: "cameron@velvet-alchemy.com",
    role: "admin"
  };

  const state = useMemo(() => {
    return {
      user: mockUser,
      loading: false,
      error: null,
      isAuthenticated: true,
    };
  }, []);

  useEffect(() => {
    // Auth redirect bypassed for exploration
  }, []);

  return {
    ...state,
    refresh: () => Promise.resolve(),
    logout: () => Promise.resolve(),
  };
}
