import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SearchCommand from "./SearchCommand";

afterEach(() => cleanup());

describe("SearchCommand", () => {
  it("opens with keyboard shortcut and searches routes", () => {
    render(<SearchCommand />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog", { name: /Search FactorForge/i })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: /Search research/i }), { target: { value: "reports" } });
    expect(screen.getByRole("link", { name: /Reports/i })).toHaveAttribute("href", "/reports");
  });

  it("shows an empty state when nothing matches", () => {
    render(<SearchCommand />);
    fireEvent.click(screen.getByRole("button", { name: /Search FactorForge/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /Search research/i }), { target: { value: "zzzz-no-match" } });
    expect(screen.getByText(/No results found/i)).toBeInTheDocument();
  });

  it("supports arrows, keeps Tab inside, and restores focus and scroll on Escape", () => {
    document.body.style.overflow = "auto";
    render(<SearchCommand />);
    const trigger = screen.getByRole("button", { name: /Search FactorForge/i });
    trigger.focus();
    fireEvent.click(trigger);
    const input = screen.getByRole("textbox", { name: /Search research/i });
    expect(input).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    const links = screen.getAllByRole("link");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(links[0]).toHaveFocus();
    fireEvent.keyDown(links[0], { key: "ArrowUp" });
    expect(links.at(-1)).toHaveFocus();
    fireEvent.keyDown(links.at(-1)!, { key: "Tab" });
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
    expect(links.at(-1)).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("auto");
    document.body.style.overflow = "";
  });

  it("opens the first research result with Enter and closes the dialog", () => {
    render(<SearchCommand />);
    fireEvent.click(screen.getByRole("button", { name: /Search FactorForge/i }));
    const input = screen.getByRole("textbox", { name: /Search research/i });
    fireEvent.change(input, { target: { value: "Binance evidence" } });
    const link = screen.getByRole("link", { name: /Binance.*evidence/i });
    // Prevent jsdom navigation while retaining the real link click and close behavior.
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("portals the modal outside the sticky header and closes on backdrop click", () => {
    const { container } = render(<header><SearchCommand /></header>);
    fireEvent.click(screen.getByRole("button", { name: /Search FactorForge/i }));
    const dialog = screen.getByRole("dialog");
    expect(container.contains(dialog)).toBe(false);
    fireEvent.mouseDown(dialog);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
