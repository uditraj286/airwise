import {
  CalendarCheck,
  HeartPulse,
  HelpCircle,
  Home,
  LayoutGrid,
  MessageCircle,
  Settings,
  Users,
} from "lucide-react";
import type { DictKey } from "@/i18n/dict";

export interface NavItem {
  href: string;
  label: DictKey;
  icon: typeof LayoutGrid;
}

/** "Menu" group in the sidebar. */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "nav_dashboard", icon: LayoutGrid },
  { href: "/plan", label: "nav_plan", icon: CalendarCheck },
  { href: "/ask", label: "nav_ask", icon: MessageCircle },
  { href: "/hacks", label: "nav_hacks", icon: Home },
  { href: "/health", label: "nav_health", icon: HeartPulse },
  { href: "/onboarding", label: "nav_household", icon: Users },
];

/** "General" group in the sidebar. */
export const SECONDARY_NAV: NavItem[] = [
  { href: "/settings", label: "nav_settings", icon: Settings },
  { href: "/hacks#myths", label: "nav_help", icon: HelpCircle },
];
