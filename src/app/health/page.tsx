import type { Metadata } from "next";
import { HealthView } from "@/components/HealthView";

export const metadata: Metadata = { title: "Health & help" };

export default function HealthPage() {
  return <HealthView />;
}
