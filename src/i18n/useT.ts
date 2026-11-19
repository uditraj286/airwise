"use client";

import { translate, type DictKey } from "@/i18n/dict";
import { useProfile } from "@/lib/profile/store";

/** Translation hook bound to the household's chosen language. */
export function useT(): (key: DictKey) => string {
  const { profile } = useProfile();
  return (key) => translate(profile.language, key);
}
