"use client";

import React from "react";
import AdminRouteGuard from "../../../src/components/auth/AdminRouteGuard";

/**
 * withAdminAuth
 *
 * Lightweight HOC for App Router pages that should be admin-only.
 *
 * This reuses the existing AdminRouteGuard from the legacy pages
 * router so we have a single source of truth for admin gating.
 */
export function withAdminAuth<P>(Component: React.ComponentType<P>): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <AdminRouteGuard>
        <Component {...props} />
      </AdminRouteGuard>
    );
  };

  WrappedComponent.displayName = `withAdminAuth(${Component.displayName || Component.name || "Component"})`;

  return WrappedComponent;
}
