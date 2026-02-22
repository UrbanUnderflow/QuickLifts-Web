import React from "react";

interface AdminLayoutProps {
  title?: string;
  children: React.ReactNode;
}

/**
 * AdminLayout
 *
 * Shared shell for admin-only views in the App Router. Keeps the
 * visual framing consistent (background, padding, header) while
 * letting each page define its own inner content.
 */
export function AdminLayout({ title, children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4">
        {title && <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>}
      </header>
      <main className="p-6 space-y-6">{children}</main>
    </div>
  );
}
