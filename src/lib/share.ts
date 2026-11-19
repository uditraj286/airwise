import type { DayOutlook } from "@/lib/air/dayWindows";
import type { AqiCategory, Language } from "@/lib/types";

const CATEGORY: Record<Language, Record<AqiCategory, string>> = {
  en: {
    good: "Good",
    satisfactory: "Satisfactory",
    moderate: "Moderate",
    poor: "Poor",
    very_poor: "Very Poor",
    severe: "Severe",
  },
  hi: {
    good: "अच्छी",
    satisfactory: "संतोषजनक",
    moderate: "मध्यम",
    poor: "खराब",
    very_poor: "बहुत खराब",
    severe: "गंभीर",
  },
};

export interface ShareInput {
  city: string;
  aqi: number;
  category: AqiCategory;
  outlook: Pick<DayOutlook, "goOut" | "stayIn">;
  steps: string[];
  language: Language;
}

/** Plain-text daily summary a family can forward to relatives or a housing-society group. */
export function shareText({ city, aqi, category, outlook, steps, language }: ShareInput): string {
  const place = city.split(",")[0] ?? city;
  const top = steps.slice(0, 3);
  if (language === "hi") {
    const lines = [`AirWise · ${place} आज: AQI ${aqi} (${CATEGORY.hi[category]})`];
    if (outlook.goOut) lines.push(`बाहर जाने का सबसे अच्छा समय: ${outlook.goOut.label}`);
    if (outlook.stayIn.length)
      lines.push(`घर में रहें, खिड़कियाँ बंद: ${outlook.stayIn.map((w) => w.label).join(", ")}`);
    if (top.length) lines.push(`आज के कदम: ${top.map((s, i) => `${i + 1}. ${s}`).join(" ")}`);
    return lines.join("\n");
  }
  const lines = [`AirWise · ${place} today: AQI ${aqi} (${CATEGORY.en[category]})`];
  if (outlook.goOut)
    lines.push(
      `${outlook.goOut.safe ? "Best time to go out" : "Least bad time to go out"}: ${outlook.goOut.label}`,
    );
  if (outlook.stayIn.length)
    lines.push(`Stay in, windows shut: ${outlook.stayIn.map((w) => w.label).join(", ")}`);
  if (top.length) lines.push(`Today's steps: ${top.map((s, i) => `${i + 1}. ${s}`).join(" ")}`);
  return lines.join("\n");
}

export const whatsappUrl = (text: string): string => `https://wa.me/?text=${encodeURIComponent(text)}`;

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

/** Native share sheet when available, otherwise copy to the clipboard. */
export async function shareOrCopy(text: string, nav: Navigator = navigator): Promise<ShareResult> {
  if (typeof nav.share === "function") {
    try {
      await nav.share({ title: "AirWise today", text });
      return "shared";
    } catch (err) {
      if ((err as Error).name === "AbortError") return "cancelled";
    }
  }
  try {
    await nav.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
