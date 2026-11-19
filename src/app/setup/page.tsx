import type { Metadata } from "next";
import { OnboardingForm } from "@/components/OnboardingForm";

export const metadata: Metadata = { title: "Set up your household" };

export default function SetupPage() {
  return <OnboardingForm mode="setup" />;
}
