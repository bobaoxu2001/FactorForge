import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SearchCommand from "./SearchCommand";

afterEach(() => cleanup());

describe("SearchCommand", () => {
  it("opens with keyboard shortcut and searches routes", () => {
    render(<SearchCommand />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog", { name: /Search FactorForge/i })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Search symbols/i), { target: { value: "reports" } });
    expect(screen.getByRole("link", { name: /Reports/i })).toHaveAttribute("href", "/reports");
  });

  it("shows an empty state when nothing matches", () => {
    render(<SearchCommand />);
    fireEvent.click(screen.getByRole("button", { name: /Search FactorForge/i }));
    fireEvent.change(screen.getByPlaceholderText(/Search symbols/i), { target: { value: "zzzz-no-match" } });
    expect(screen.getByText(/No results found/i)).toBeInTheDocument();
  });
});
