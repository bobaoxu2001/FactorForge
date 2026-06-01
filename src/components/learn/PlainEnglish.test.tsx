import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import PlainEnglish from "./PlainEnglish";
import Term from "./Term";

describe("<PlainEnglish>", () => {
  afterEach(() => cleanup());

  it("renders the default 'In plain English' label and its body copy", () => {
    render(<PlainEnglish>A practice run with pretend money.</PlainEnglish>);
    expect(screen.getByText(/in plain english/i)).toBeInTheDocument();
    expect(screen.getByText(/practice run with pretend money/i)).toBeInTheDocument();
  });

  it("accepts a custom title", () => {
    render(<PlainEnglish title="What is this?">Body.</PlainEnglish>);
    expect(screen.getByText("What is this?")).toBeInTheDocument();
  });

  it("composes with inline <Term> tooltips for any surviving jargon", () => {
    render(
      <PlainEnglish>
        It checks <Term term="correlation">correlation</Term> between legs.
      </PlainEnglish>,
    );
    // The Term renders as an interactive trigger inside the callout.
    expect(screen.getByRole("button", { name: /correlation/i })).toBeInTheDocument();
  });
});
