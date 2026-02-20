import React, { ReactNode, useState } from "react";

export type TooltipProps = {
  label: string;
  children: ReactNode;
};

/**
 * Minimal tooltip component for the web app.
 *
 * This is intentionally lightweight and does not depend on any external UI
 * libraries. It shows the tooltip label on hover/focus.
 */
export function Tooltip({ label, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span className="absolute z-10 -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white shadow-lg">
          {label}
        </span>
      )}
    </span>
  );
}

export default Tooltip;

