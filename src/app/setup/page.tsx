import type { Metadata } from "next";
import { OnboardingForm } from "@/components/OnboardingForm";

export const metadata: Metadata = { title: "Set up your household" };

/** `?new=1` (from "Continue as a guest") always starts a blank household, like a brand-new user. */
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: fresh } = await searchParams;
  return <OnboardingForm mode="setup" fresh={fresh === "1"} />;
}
