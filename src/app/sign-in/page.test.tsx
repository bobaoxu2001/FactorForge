import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/persistence/db", () => ({ isPersistenceAvailable: vi.fn() }));
vi.mock("@/lib/auth/actions", () => ({ signInAction: vi.fn() }));
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
import SignInPage from "./page";

const setAvailable = (value: boolean) =>
  (isPersistenceAvailable as unknown as ReturnType<typeof vi.fn>).mockReturnValue(value);

afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

describe("SignInPage", () => {
  it("shows the demo-mode notice when persistence is unavailable", () => {
    setAvailable(false);
    const { container } = render(SignInPage({ searchParams: {} }));
    expect(screen.getByText(/Sign-in is disabled in the public demo/i)).toBeInTheDocument();
    expect(container.querySelector('input[name="password"]')).toBeNull();
    expect(screen.queryByText(/Persistence layer unavailable/i)).toBeNull();
  });

  it("passes protected-route context through from a redirected protected page", () => {
    setAvailable(false);
    render(SignInPage({ searchParams: { next: "/my-watchlist", area: "watchlist" } }));
    expect(screen.getByText(/requires saved-preference storage \(personal watchlists\)/i)).toBeInTheDocument();
    expect(screen.getByText(/read-only for safety/i)).toBeInTheDocument();
  });

  it("renders the sign-in form when persistence is available", () => {
    setAvailable(true);
    const { container } = render(SignInPage({ searchParams: {} }));
    expect(container.querySelector('input[name="username"]')).not.toBeNull();
    expect(screen.queryByText(/Sign-in is disabled in the public demo/i)).toBeNull();
  });
});
