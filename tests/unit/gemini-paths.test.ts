import type * as GeminiModule from "@/lib/ai/gemini";
import { air, NOW, profile } from "../fixtures";

const generateContent = vi.fn();
const generateContentStream = vi.fn();

vi.mock("@/lib/ai/gemini", async (importOriginal) => {
  const actual = await importOriginal<typeof GeminiModule>();
  return { ...actual, getGemini: () => ({ models: { generateContent, generateContentStream } }) };
});

const { generatePlan } = await import("@/lib/ai/plan");
const { geminiModels } = await import("@/lib/ai/gemini");
const { streamChat } = await import("@/lib/ai/chat");

const llmPlan = {
  headline: "Stay in this morning",
  summary: "Peaks early; go out mid-afternoon.",
  items: [
    {
      actionId: "close_windows_peaks",
      time: "7–11 AM",
      title: "Shut windows",
      why: "Morning peak.",
      forWhom: ["Everyone"],
    },
    {
      actionId: "run_purifier_night",
      time: "Tonight",
      title: "Not applicable",
      why: "No purifier.",
      forWhom: [],
    },
    { actionId: "transit_commute", time: "Tomorrow", title: "Metro", why: "Cuts CO2.", forWhom: ["Rahul"] },
  ],
  healthNote: "Watch Aarav's breathing.",
  communityTip: "Start a car-pool.",
};

describe("Gemini plan path", () => {
  beforeEach(() => {
    generateContent.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("uses structured output, drops inapplicable actions and attaches engine impacts", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(llmPlan) });
    const plan = await generatePlan(profile(), air(), NOW);
    expect(plan.source).toBe("gemini");
    expect(plan.items.map((i) => i.actionId)).toEqual(["close_windows_peaks", "transit_commute"]);
    expect(plan.items[1]?.impact.co2KgWeek).toBeGreaterThan(0);
    const call = generateContent.mock.calls[0]?.[0];
    expect(call.config.responseMimeType).toBe("application/json");
    expect(call.config.responseJsonSchema).toBeDefined();
    expect(call.contents[0].parts[0].text).toContain("FACTS:");
  });

  it("tries every model in the fallback chain on invalid output, then falls back to rules", async () => {
    generateContent.mockResolvedValue({ text: "not json" });
    const plan = await generatePlan(profile(), air(), NOW);
    const models = generateContent.mock.calls.map((c) => c[0].model);
    expect(models).toEqual(geminiModels());
    expect(models[0]).toBe(models[1]); // primary retried once
    expect(plan.source).toBe("rules");
  });

  it("recovers from a momentary overload on the primary model", async () => {
    generateContent.mockRejectedValueOnce(Object.assign(new Error("503 high demand"), { status: 503 }));
    generateContent.mockResolvedValueOnce({ text: JSON.stringify(llmPlan) });
    const plan = await generatePlan(profile(), air(), NOW);
    expect(plan.source).toBe("gemini");
    expect(plan.model).toBe(geminiModels()[0]);
  });

  it("falls back when every suggested action is invalid", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ ...llmPlan, items: [llmPlan.items[1]] }) });
    expect((await generatePlan(profile(), air(), NOW)).source).toBe("rules");
  });

  it("falls back when the API throws", async () => {
    generateContent.mockRejectedValue(new Error("quota"));
    expect((await generatePlan(profile(), air(), NOW)).source).toBe("rules");
  });
});

describe("Gemini chat path", () => {
  it("streams chunks and wraps user turns", async () => {
    generateContentStream.mockResolvedValue(
      (async function* () {
        yield { text: "Go out " };
        yield { text: "" };
        yield { text: "at 2 PM." };
      })(),
    );
    const out: string[] = [];
    for await (const c of streamChat(
      profile(),
      air(),
      [
        { role: "user", text: "hi" },
        { role: "assistant", text: "hello" },
      ],
      "When?",
      NOW,
    ))
      out.push(c);
    expect(out.join("")).toBe("Go out at 2 PM.");
    const { contents } = generateContentStream.mock.calls[0]?.[0];
    expect(contents.at(-1).parts[0].text).toContain("<user_question>");
    expect(contents.at(-2).role).toBe("model");
  });

  it("falls back to the rule answer when every model fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    generateContentStream.mockRejectedValue(new Error("down"));
    const out: string[] = [];
    for await (const c of streamChat(profile(), air(), [], "When?", NOW)) out.push(c);
    expect(out.join("")).toContain("built-in rules");
  });
});
