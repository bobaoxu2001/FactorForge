import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AiTransparencyNote from "./AiTransparencyNote";

describe("AiTransparencyNote", () => {
  it("explains template and LLM memo sources", () => {
    render(<AiTransparencyNote />);
    expect(screen.getByText(/Template memo/i)).toBeInTheDocument();
    expect(screen.getByText(/LLM memo/i)).toBeInTheDocument();
    expect(screen.getByText(/Numbers always come from the research engine/i)).toBeInTheDocument();
    expect(screen.getByText(/No financial advice/i)).toBeInTheDocument();
  });
});
