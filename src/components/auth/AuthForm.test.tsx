import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthFormState } from "@/lib/auth/actions";

// `useFormState`/`useFormStatus` are supplied by Next's bundler at runtime and
// aren't exported by react-dom under plain jsdom. Stub them so the form renders.
vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormState: (action: unknown, initial: unknown) => [initial, action],
    useFormStatus: () => ({ pending: false }),
  };
});

import AuthForm from "./AuthForm";

afterEach(() => cleanup());

// A no-op stand-in for the server action; the form is never submitted in these
// render-only tests, so the action body never runs.
const noopAction = async (_state: AuthFormState, _data: FormData): Promise<AuthFormState> => ({});

describe("AuthForm", () => {
  it("renders the real credential form when persistence is available (sign-up)", () => {
    const { container } = render(<AuthForm mode="sign-up" action={noopAction} />);
    expect(screen.getByRole("button", { name: /Create account/i })).toBeInTheDocument();
    expect(container.querySelector('input[name="username"]')).not.toBeNull();
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
    expect(screen.queryByText(/Persistence layer unavailable/i)).toBeNull();
  });

  it("renders the sign-in form with a link to create an account", () => {
    render(<AuthForm mode="sign-in" action={noopAction} />);
    expect(screen.getByRole("button", { name: /^Sign in$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Create one/i })).toHaveAttribute("href", "/sign-up");
  });
});
