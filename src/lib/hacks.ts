/** Curated indoor hacks, sustainable swaps and myth-busters shown in the library. */
export type HackCategory = "indoor" | "outdoor" | "swap" | "myth";

export interface Hack {
  id: string;
  category: HackCategory;
  title: string;
  body: string;
  cost: "Free" | "Low" | "Medium";
  source: string;
}

export const HACKS: Hack[] = [
  {
    id: "seal",
    category: "indoor",
    title: "Seal the gaps",
    body: "Use door snakes and foam tape on window frames in the room you sleep in. Lower air exchange keeps outdoor PM2.5 out during the night peak.",
    cost: "Low",
    source: "Riley et al. 2002",
  },
  {
    id: "diy",
    category: "indoor",
    title: "DIY purifier for about ₹1,500",
    body: "Strap a fine-dust filter (MERV-13 or HEPA grade) to the back of a table or box fan. Run it on medium in a closed bedroom; it can cut indoor PM2.5 by half or more.",
    cost: "Low",
    source: "Dal Porto et al. 2022",
  },
  {
    id: "size",
    category: "indoor",
    title: "Size your purifier properly",
    body: "Look for the clean air delivery rate on the box. For a bedroom 3 metres wide, 4 metres long and 3 metres high, look for about 150 to 180 cubic metres of clean air per hour.",
    cost: "Medium",
    source: "AHAM / US EPA guide to air cleaners",
  },
  {
    id: "mop",
    category: "indoor",
    title: "Wet-mop, don't sweep",
    body: "Dry sweeping lifts settled dust back into the air. Wet-mop floors and wipe surfaces with a damp cloth.",
    cost: "Free",
    source: "US EPA indoor air quality guidance",
  },
  {
    id: "cook",
    category: "indoor",
    title: "Lid on, exhaust on",
    body: "Turn on the chimney before cooking, use lids and back burners, and avoid deep-frying on peak smog evenings.",
    cost: "Free",
    source: "Lunden et al. 2015",
  },
  {
    id: "coil",
    category: "indoor",
    title: "Skip mosquito coils",
    body: "One burning coil emits as much fine particulate matter as 75–137 cigarettes. Use bed nets or plug-in repellents instead.",
    cost: "Low",
    source: "Liu et al. 2003, Environ. Health Perspect.",
  },
  {
    id: "air",
    category: "indoor",
    title: "Air out at the cleanest hour",
    body: "Open windows for 10–15 minutes in the cleanest afternoon hour shown on your dashboard to flush indoor CO₂ and cooking fumes.",
    cost: "Free",
    source: "AirWise forecast",
  },
  {
    id: "time",
    category: "outdoor",
    title: "Time your outdoor hour",
    body: "Winter PM2.5 is usually worst before 10 AM and after 7 PM because of temperature inversions. Shift walks and play to mid-afternoon.",
    cost: "Free",
    source: "CPCB diurnal monitoring data",
  },
  {
    id: "n95",
    category: "outdoor",
    title: "N95 that actually fits",
    body: "Check for a good seal: no air should escape around the nose when you exhale. Cloth and surgical masks offer little protection from PM2.5.",
    cost: "Low",
    source: "Cherrie et al. 2018",
  },
  {
    id: "route",
    category: "outdoor",
    title: "Take the back roads",
    body: "Walking or cycling one street away from a busy arterial road can lower your exposure noticeably.",
    cost: "Free",
    source: "Goel et al. 2015",
  },
  {
    id: "metro",
    category: "swap",
    title: "Metro over car",
    body: "Metro cabins are filtered and cut per-km CO₂ by over 80% compared with a petrol car.",
    cost: "Free",
    source: "DMRC 2019; ARAI 2008",
  },
  {
    id: "pool",
    category: "swap",
    title: "Car-pool rota",
    body: "Start a car-pool group for school runs or the office in your society chat; two per car halves per-person emissions.",
    cost: "Free",
    source: "ARAI 2008",
  },
  {
    id: "induction",
    category: "swap",
    title: "Induction for everyday cooking",
    body: "Induction removes combustion fumes from your kitchen and, on India's grid, emits a little less CO₂ than LPG.",
    cost: "Medium",
    source: "CEA 2023; IPCC 2006",
  },
  {
    id: "compost",
    category: "swap",
    title: "Compost, don't burn",
    body: "Burning 1 kg of leaves releases about 8 g of PM2.5. Compost them, or hand them to municipal collection.",
    cost: "Free",
    source: "Akagi et al. 2011",
  },
  {
    id: "idle",
    category: "swap",
    title: "Engine off at red lights",
    body: "Switch off the engine at signals longer than 10 seconds; idling adds exhaust right where people are breathing.",
    cost: "Free",
    source: "Petroleum Conservation Research Association",
  },
  {
    id: "plants",
    category: "myth",
    title: "Myth: house plants clean the air",
    body: "You would need hundreds of plants per room to match even a small purifier. Keep them for joy, not filtration.",
    cost: "Free",
    source: "Cummings & Waring 2019, J. Exposure Sci. Environ. Epidemiol.",
  },
  {
    id: "ionizer",
    category: "myth",
    title: "Myth: ionisers are just as good",
    body: "Ionisers and 'ozone' purifiers can create ozone, a lung irritant. Choose a true HEPA purifier with no ioniser.",
    cost: "Free",
    source: "California Air Resources Board",
  },
  {
    id: "indoorsafe",
    category: "myth",
    title: "Myth: indoors is automatically safe",
    body: "Without filtration, indoor PM2.5 is often 60–90% of the outdoor level. Close windows during peaks and filter the room you sleep in.",
    cost: "Free",
    source: "Riley et al. 2002",
  },
];

export const CATEGORY_LABEL: Record<HackCategory | "all", string> = {
  all: "All",
  indoor: "Indoor hacks",
  outdoor: "Outdoors",
  swap: "Sustainable swaps",
  myth: "Myth-busters",
};

/** Filter by category and case-insensitive text search across title and body. */
export function filterHacks(hacks: Hack[], category: HackCategory | "all", query: string): Hack[] {
  const q = query.trim().toLowerCase();
  return hacks.filter(
    (h) =>
      (category === "all" || h.category === category) &&
      (!q || `${h.title} ${h.body}`.toLowerCase().includes(q)),
  );
}
