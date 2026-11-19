import type { Metadata } from "next";
import { ChatView } from "@/components/chat/ChatView";

export const metadata: Metadata = { title: "Ask AirWise" };

export default function AskPage() {
  return <ChatView />;
}
