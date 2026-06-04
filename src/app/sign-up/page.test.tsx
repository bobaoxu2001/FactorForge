import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the persistence probe so we can drive both branches, and the server
// action so importing the page doesn't pull the auth/session chain.
vi.mock("@/lib/persistence/db", () => ({ isPersistenceAvailable: vi.fn() }));
vi.mock("@/lib/auth/actions", () => ({ signUpAction: vi.fn() }));
// react-dom's form hooks are provided by Next's bundler, not plain jsdom.
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormState: (action: unknown, initial: unknown) => [initial, action],
    useFormStatus: () => ({ pending: false }),
  };
});

import { isPersistenceAvailable } from "@/lib/persistence/db";
import SignUpPage from "./page";

const setAvailable = (value: boolean) =>
  (isPersistenceAvailable as unknown as ReturnType<typeof vi.fn>).mockReturnValue(value);

afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

describe("SignUpPage", () => {
  it("shows the demo-mode notice and no credential form when persistence is unavailable", () => {
    setAvailable(false);
    const { container } = render(SignUpPage({ searchParams: {} }));
    expect(screen.getByText(/Account creation is disabled in the public demo/i)).toBeInTheDocument();
    expect(container.querySelector('input[name="password"]')).toBeNull();
    expect(screen.queryByText(/Persistence layer unavailable/i)).toBeNull();
    expect(screen.getByRole("link", { name: /Continue exploring public demo/i })).toHaveAttribute("href", "/");
  });

  it("renders the account form when persistence is available", () => {
    setAvailable(true);
    const { container } = render(SignUpPage({ searchParams: {} }));
    expect(container.querySelector('input[name="username"]')).not.toBeNull();
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
    expect(screen.queryByText(/Account creation is disabled in the public demo/i)).toBeNull();
  });
});
