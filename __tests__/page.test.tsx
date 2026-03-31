import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "@/app/page";

describe("landing page", () => {
  it("renders the order button and contact info", () => {
    render(<Page />);

    expect(screen.getByRole("link", { name: /order now/i })).toHaveAttribute(
      "href",
      "/order"
    );
    expect(screen.getByText(/vienna, austria/i)).toBeInTheDocument();
    expect(screen.getByText(/hello@biteva.at/i)).toBeInTheDocument();
  });
});
