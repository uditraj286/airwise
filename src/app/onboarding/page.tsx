import type { Metadata } from "next";
import { OnboardingForm } from "@/components/OnboardingForm";

export const metadata: Metadata = { title: "Your household" };

export default function OnboardingPage() {
  return <OnboardingForm />;
}
