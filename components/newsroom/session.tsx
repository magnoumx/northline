"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { Permission, Role } from "@/lib/auth/permissions";

type NewsroomSession = {
  email: string;
  role: Role;
  permissions: readonly Permission[];
  brandName: string;
  brandShortName: string;
  demoMode: boolean;
};

const NewsroomSessionContext = createContext<NewsroomSession | null>(null);

export function NewsroomSessionProvider({
  children,
  session,
}: {
  children: ReactNode;
  session: NewsroomSession;
}) {
  return (
    <NewsroomSessionContext.Provider value={session}>
      {children}
    </NewsroomSessionContext.Provider>
  );
}

export function useNewsroomSession(): NewsroomSession {
  const session = useContext(NewsroomSessionContext);
  if (!session) {
    throw new Error(
      "Newsroom components must render inside NewsroomSessionProvider.",
    );
  }
  return session;
}

export function hasNewsroomPermission(
  session: NewsroomSession,
  required: readonly Permission[],
): boolean {
  return required.some((permission) => session.permissions.includes(permission));
}
