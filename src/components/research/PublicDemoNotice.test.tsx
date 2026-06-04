import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicDemoNotice from "./PublicDemoNotice";

describe("PublicDemoNotice", () => {
  it("states safe public demo boundaries", () => {
    render(<PublicDemoNotice />);
    expect(screen.getByText(/Public demo mode/i)).toBeInTheDocument();
    expect(screen.getByText(/no financial advice/i)).toBeInTheDocument();
    expect(screen.getByText(/no broker connection/i)).toBeInTheDocument();
    expect(screen.getByText(/no live trading/i)).toBeInTheDocument();
    expect(screen.getByText(/fallback\/demo data/i)).toBeInTheDocument();
  });
});
