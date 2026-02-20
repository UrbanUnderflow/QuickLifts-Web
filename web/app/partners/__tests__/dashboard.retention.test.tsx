import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import PartnerDashboardPage from "../../partners/dashboard";
import { getPartnerRetention } from "../../partners/api/partnerRetention";

jest.mock("../../partners/api/partnerRetention");

const mockedGetPartnerRetention = getPartnerRetention as jest.MockedFunction<
  typeof getPartnerRetention
>;

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("PartnerDashboardPage retention section", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders retention chart and shows green styling when latest retention is >= 40%", async () => {
    mockedGetPartnerRetention.mockResolvedValueOnce([
      { date: "2026-02-01", retentionRate: 0.35 },
      { date: "2026-02-02", retentionRate: 0.4 },
      { date: "2026-02-03", retentionRate: 0.45 },
    ]);

    render(<PartnerDashboardPage />);

    await flushPromises();

    const heading = await screen.findByRole("heading", {
      name: /Retention \(30-Day Behavior\/Usage\)/i,
    });
    expect(heading).toBeInTheDocument();

    const chartElement = screen.getByText(/02-01|02-02|02-03/);
    expect(chartElement).toBeInTheDocument();

    const currentRetention = screen.getByText(/45%/);
    expect(currentRetention).toBeInTheDocument();
    expect(currentRetention).toHaveClass("text-green-600");

    const tooltipTrigger = screen.getByText("?");
    expect(tooltipTrigger).toBeInTheDocument();
  });

  it("uses red styling when latest retention is below 40% and exposes non-clinical clarification", async () => {
    mockedGetPartnerRetention.mockResolvedValueOnce([
      { date: "2026-02-01", retentionRate: 0.25 },
      { date: "2026-02-02", retentionRate: 0.3 },
    ]);

    render(<PartnerDashboardPage />);

    await flushPromises();

    const currentRetention = await screen.findByText(/30%/);
    expect(currentRetention).toBeInTheDocument();
    expect(currentRetention).toHaveClass("text-red-600");

    const summaryLabel = screen.getByText(/Current 30-day retention/i);
    expect(summaryLabel).toBeInTheDocument();

    const behaviorCopy = screen.getByText(/behavior and app usage/i);
    expect(behaviorCopy).toBeInTheDocument();
  });
});

