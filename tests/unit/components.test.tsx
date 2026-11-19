import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SourcesDonut } from "@/components/cards/SourcesDonut";
import { PlanItemCard } from "@/components/plan/PlanItemCard";
import { CountUp } from "@/components/ui/CountUp";
import { Segmented } from "@/components/ui/Segmented";
import { sourcesFor } from "@/lib/air/sources";
import type { PlanItem } from "@/lib/ai/plan";

describe("CountUp", () => {
  it("updates the visible number after a new air reading arrives", () => {
    const { container, rerender } = render(<CountUp value={72} />);
    rerender(<CountUp value={166} />);
    expect(container.querySelector(".tabular-nums")).toHaveTextContent("166");
  });
});

describe("Segmented", () => {
  it("exposes radio semantics and reports changes", async () => {
    const onChange = vi.fn();
    render(
      <Segmented
        label="Range"
        value="a"
        onChange={onChange}
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
      />,
    );
    expect(screen.getByRole("radio", { name: "A" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("radio", { name: "B" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

describe("SourcesDonut", () => {
  it("describes every slice to screen readers", () => {
    render(<SourcesDonut title="Sources" data={sourcesFor("Delhi")} centerLabel="top source" />);
    expect(screen.getByRole("img", { name: /Vehicles 25%/ })).toBeInTheDocument();
  });
});

describe("PlanItemCard", () => {
  const item: PlanItem = {
    actionId: "transit_commute",
    time: "Tomorrow",
    title: "Take the metro",
    why: "Cuts CO2.",
    forWhom: ["Rahul"],
    slot: "morning",
    kind: "both",
    how: "Use the metro.",
    formula: "km × EF",
    sources: ["ARAI 2008"],
    impact: {
      id: "transit_commute",
      doseAvoidedUg: 120,
      exposureReductionPct: 3.2,
      co2KgWeek: 15,
      pm25GWeek: 1.39,
    },
  };

  it("shows verified impacts, explains the maths and toggles done", async () => {
    const onToggle = vi.fn();
    render(<PlanItemCard item={item} done={false} onToggle={onToggle} />);
    expect(screen.getByText("3.2% less")).toBeInTheDocument();
    expect(screen.getByText("15 kilograms less")).toBeInTheDocument();
    await userEvent.click(screen.getByText("How is this calculated?"));
    expect(screen.getByText("ARAI 2008")).toBeVisible();
    await userEvent.click(screen.getByRole("checkbox", { name: /Take the metro/ }));
    expect(onToggle).toHaveBeenCalled();
  });
});
