import type { Metadata } from "next";
import { PlanView } from "@/components/plan/PlanView";

export const metadata: Metadata = { title: "Daily Plan" };

export default function PlanPage() {
  return <PlanView />;
}
