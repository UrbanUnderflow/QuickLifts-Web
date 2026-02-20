import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import ChallengeCreatePage from "../../challenges/create";

// Mock next/navigation so we can control the brandType query param.
jest.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === "brandType") return "gymshark";
      return null;
    },
  }),
}));

describe("ChallengeCreatePage brand templates", () => {
  it("shows Gymshark templates when brandType=gymshark and applies presets on selection", () => {
    render(<ChallengeCreatePage />);

    // Template list should include the Gymshark 30-Day Strength Streak name
    const strengthTemplate = screen.getByLabelText(/30-Day Strength Streak/i);

    // Initially, the draft fields should be empty
    const titleInput = screen.getByLabelText(/Title/i) as HTMLInputElement;
    const descriptionTextarea = screen.getByLabelText(
      /Description/i
    ) as HTMLTextAreaElement;
    const durationInput = screen.getByLabelText(
      /Duration \(days\)/i
    ) as HTMLInputElement;
    const sessionsInput = screen.getByLabelText(
      /Target sessions per week/i
    ) as HTMLInputElement;
    const styleKeyInput = screen.getByLabelText(
      /Visual style key/i
    ) as HTMLInputElement;

    expect(titleInput.value).toBe("");
    expect(descriptionTextarea.value).toBe("");
    expect(durationInput.value).toBe("");
    expect(sessionsInput.value).toBe("");
    expect(styleKeyInput.value).toBe("");

    // Select the template and verify presets are applied from config/brandChallengeTemplates.json
    fireEvent.click(strengthTemplate);

    expect(titleInput.value).toBe("30-Day Strength Streak");
    expect(descriptionTextarea.value).toMatch(/strength-first challenge/i);
    expect(Number(durationInput.value)).toBe(30);
    expect(Number(sessionsInput.value)).toBe(4);
    expect(styleKeyInput.value).toBe("gymshark-strength-dark-neon");
  });
});
