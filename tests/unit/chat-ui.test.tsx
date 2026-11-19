import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { Composer } from "@/components/chat/Composer";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";
import { groupBySlot } from "@/components/plan/PlanView";
import { slotFor } from "@/lib/ai/fallback";
import { buildContext } from "@/lib/ai/context";
import { ACTION_IDS } from "@/lib/impact/catalogue";
import type { PlanItem } from "@/lib/ai/plan";
import { air, NOW, profile } from "../fixtures";

describe("Composer", () => {
  it("sends on Enter, adds a line on Shift+Enter, and shows Stop while busy", async () => {
    const onSend = vi.fn();
    const onChange = vi.fn();
    const { rerender } = render(
      <Composer
        value="hello"
        onChange={onChange}
        onSend={onSend}
        onStop={vi.fn()}
        busy={false}
        placeholder="Ask"
      />,
    );
    const box = screen.getByLabelText("Message AirWise");
    await userEvent.type(box, "{Shift>}{Enter}{/Shift}");
    expect(onSend).not.toHaveBeenCalled();
    await userEvent.type(box, "{Enter}");
    expect(onSend).toHaveBeenCalledTimes(1);

    const onStop = vi.fn();
    rerender(
      <Composer value="" onChange={onChange} onSend={onSend} onStop={onStop} busy placeholder="Ask" />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Stop generating" }));
    expect(onStop).toHaveBeenCalled();
  });

  it("disables send for blank input and warns near the limit", () => {
    const { rerender } = render(
      <Composer
        value="   "
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        busy={false}
        placeholder="Ask"
      />,
    );
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    rerender(
      <Composer
        value={"x".repeat(450)}
        onChange={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
        busy={false}
        placeholder="Ask"
      />,
    );
    expect(screen.getByText("50 characters left")).toBeInTheDocument();
  });
});

describe("ThinkingIndicator", () => {
  it("cycles through its steps", () => {
    vi.useFakeTimers();
    render(<ThinkingIndicator />);
    expect(screen.getByText("Reading live air data…")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1400));
    expect(screen.getByText("Checking your household…")).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("ChatMessage", () => {
  it("shows thinking before the first token and plain text after", () => {
    const { rerender } = render(<ChatMessage turn={{ role: "assistant", text: "" }} streaming isLast />);
    expect(screen.getByText("Thinking")).toBeInTheDocument();
    rerender(
      <ChatMessage
        turn={{ role: "assistant", text: "**Go out** at 3 PM.\n* Wear an N95" }}
        streaming={false}
        isLast
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/Go out at 3 PM\.\s+• Wear an N95/)).toBeInTheDocument();
    expect(screen.queryByText(/\*\*/)).toBeNull();
    expect(screen.getByRole("button", { name: "Retry this answer" })).toBeInTheDocument();
  });

  it("renders the user's own words in a bubble", () => {
    render(<ChatMessage turn={{ role: "user", text: "Is it safe?" }} streaming={false} isLast={false} />);
    expect(screen.getByText("Is it safe?")).toBeInTheDocument();
  });
});

describe("plan time-of-day grouping", () => {
  const ctx = buildContext(profile(), air(), NOW);

  it("gives every action a deterministic slot", () => {
    for (const id of ACTION_IDS)
      expect(slotFor(id, ctx)).toMatch(/morning|afternoon|evening|night|anytime|this_week/);
    expect(slotFor("run_purifier_night", ctx)).toBe("night");
    expect(slotFor("carpool", ctx)).toBe("this_week");
    expect(slotFor("shift_outdoor_best_window", ctx)).toBe("afternoon"); // best hour is 2 PM in the sample
  });

  it("orders groups through the day and handles old plans without a slot", () => {
    const item = (actionId: PlanItem["actionId"], slot?: PlanItem["slot"]) =>
      ({ actionId, slot }) as PlanItem;
    const groups = groupBySlot([
      item("carpool", "this_week"),
      item("run_purifier_night", "night"),
      item("transit_commute", "morning"),
      item("n95_outdoors"),
    ]);
    expect(groups.map((g) => g.slot)).toEqual(["morning", "night", "anytime", "this_week"]);
  });
});
