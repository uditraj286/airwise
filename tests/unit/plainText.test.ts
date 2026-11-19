import { PlainTextStream, toPlainText } from "@/lib/ai/plainText";

describe("toPlainText", () => {
  it("removes bold, italics, headings, code and links", () => {
    expect(toPlainText("**Go out at 3 PM.** It's *cleaner* then.")).toBe(
      "Go out at 3 PM. It's cleaner then.",
    );
    expect(toPlainText("## Today\n__Stay in__ until `5 PM`, see [CPCB](https://cpcb.nic.in).")).toBe(
      "Today\nStay in until 5 PM, see CPCB.",
    );
    expect(toPlainText("> quoted\n~~old~~ new\n---")).toBe("quoted\nold new\n");
  });

  it("turns markdown bullets into •", () => {
    expect(toPlainText("Steps:\n* Shut windows\n- Run the purifier\n+ Wear an N95")).toBe(
      "Steps:\n• Shut windows\n• Run the purifier\n• Wear an N95",
    );
  });

  it("keeps maths and numbered lists intact", () => {
    expect(toPlainText("1. PM2.5 is 3×4 m\n2. 5 * 3 = 15")).toBe("1. PM2.5 is 3×4 m\n2. 5 * 3 = 15");
    expect(toPlainText("snake_case_name stays")).toBe("snake_case_name stays");
  });

  it("drops an unclosed bold marker and squeezes blank lines", () => {
    expect(toPlainText("**Avoid")).toBe("Avoid");
    expect(toPlainText("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("does not treat a mid-line continuation as a line start", () => {
    expect(toPlainText("- not a bullet", { atLineStart: false })).toBe("- not a bullet");
  });
});

describe("PlainTextStream", () => {
  const run = (chunks: string[]): { parts: string[]; text: string } => {
    const s = new PlainTextStream();
    const parts = chunks.map((c) => s.push(c));
    parts.push(s.flush());
    return { parts, text: parts.join("") };
  };

  it("never leaks markers split across chunks", () => {
    const { text, parts } = run([
      "Dadi should **wa",
      "lk at 3 PM** when",
      " the air is cleanest today.\n* Wear",
      " an N95",
    ]);
    expect(text).toBe("Dadi should walk at 3 PM when the air is cleanest today.\n• Wear an N95");
    expect(parts.join("").includes("*")).toBe(false);
  });

  it("releases words before the line ends, for a live typing feel", () => {
    const s = new PlainTextStream();
    expect(s.push("Short")).toBe("");
    expect(s.push(" answer that is long enough to release ")).toBe(
      "Short answer that is long enough to release ",
    );
  });

  it("holds text while a bold span is open", () => {
    const s = new PlainTextStream();
    expect(s.push("**This bold span is still being written and ")).toBe("");
    expect(s.push("now closed** done.")).toBe("This bold span is still being written and now closed ");
    expect(s.flush()).toBe("done.");
  });
});
