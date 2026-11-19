import type { Metadata } from "next";
import { Suspense } from "react";
import { HacksView } from "@/components/HacksView";

export const metadata: Metadata = { title: "Indoor Hacks & Swaps" };

export default function HacksPage() {
  return (
    <Suspense>
      <HacksView />
    </Suspense>
  );
}
