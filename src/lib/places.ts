"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { createStore } from "@/lib/profile/store";

export const PlaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type Place = z.infer<typeof PlaceSchema>;

/** Places the family has looked up (home, school, office, grandparents…), newest first, kept on this device. */
export const placesStore = createStore<Place[]>("airwise.places.v1", z.array(PlaceSchema).max(8), []);

const same = (a: Place, b: Place): boolean =>
  a.lat.toFixed(2) === b.lat.toFixed(2) && a.lon.toFixed(2) === b.lon.toFixed(2);

/** Add or move a place to the front of the list (max 8). */
export function rememberPlace(place: Place, list: Place[] = placesStore.read()): Place[] {
  const next = [place, ...list.filter((p) => !same(p, place))].slice(0, 8);
  placesStore.write(next);
  return next;
}

export function forgetPlace(place: Place, list: Place[] = placesStore.read()): Place[] {
  const next = list.filter((p) => !same(p, place));
  placesStore.write(next);
  return next;
}

export function usePlaces(): Place[] {
  return useSyncExternalStore(placesStore.subscribe, placesStore.read, () => placesStore.fallback);
}

/** Big Indian cities offered as one-tap choices before the user types. */
export const POPULAR_CITIES: Place[] = [
  { name: "New Delhi, Delhi, India", lat: 28.6139, lon: 77.209 },
  { name: "Mumbai, Maharashtra, India", lat: 19.076, lon: 72.8777 },
  { name: "Kolkata, West Bengal, India", lat: 22.5726, lon: 88.3639 },
  { name: "Bengaluru, Karnataka, India", lat: 12.9716, lon: 77.5946 },
  { name: "Chennai, Tamil Nadu, India", lat: 13.0827, lon: 80.2707 },
  { name: "Hyderabad, Telangana, India", lat: 17.385, lon: 78.4867 },
  { name: "Lucknow, Uttar Pradesh, India", lat: 26.8467, lon: 80.9462 },
  { name: "Patna, Bihar, India", lat: 25.5941, lon: 85.1376 },
  { name: "Kanpur, Uttar Pradesh, India", lat: 26.4499, lon: 80.3319 },
  { name: "Pune, Maharashtra, India", lat: 18.5204, lon: 73.8567 },
];
