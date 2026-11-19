/**
 * Indicative winter PM2.5 source shares. These are rounded syntheses of published source-apportionment studies,
 * shown to explain *why* the family's swaps matter, not as live measurements.
 */
export interface SourceShare {
  key: "vehicles" | "biomass" | "dust" | "industry" | "other";
  label: string;
  pct: number;
}

export interface SourceProfile {
  region: string;
  citation: string;
  shares: SourceShare[];
}

const DELHI_NCR: SourceProfile = {
  region: "Delhi NCR, winter",
  citation: "Indicative, from IIT Kanpur (2016) and TERI–ARAI (2018) source-apportionment studies",
  shares: [
    { key: "biomass", label: "Stubble & biomass burning", pct: 30 },
    { key: "vehicles", label: "Vehicles", pct: 25 },
    { key: "dust", label: "Road & construction dust", pct: 20 },
    { key: "industry", label: "Industry & power", pct: 15 },
    { key: "other", label: "Waste burning & other", pct: 10 },
  ],
};

const INDO_GANGETIC: SourceProfile = {
  region: "Indo-Gangetic plain city, winter",
  citation: "Indicative, from CPCB city action plans and UrbanEmissions.info (2019)",
  shares: [
    { key: "biomass", label: "Household fuels & biomass", pct: 32 },
    { key: "dust", label: "Road & construction dust", pct: 24 },
    { key: "vehicles", label: "Vehicles", pct: 20 },
    { key: "industry", label: "Industry & brick kilns", pct: 14 },
    { key: "other", label: "Waste burning & other", pct: 10 },
  ],
};

const GENERIC: SourceProfile = {
  region: "Typical large city, winter",
  citation: "Indicative, from WHO source-apportionment database (Karagulian et al. 2015)",
  shares: [
    { key: "vehicles", label: "Vehicles", pct: 25 },
    { key: "biomass", label: "Domestic fuel burning", pct: 20 },
    { key: "dust", label: "Dust", pct: 20 },
    { key: "industry", label: "Industry & power", pct: 22 },
    { key: "other", label: "Other", pct: 13 },
  ],
};

const DELHI_RE = /delhi|gurugram|gurgaon|noida|ghaziabad|faridabad/i;
const IGP_RE =
  /lucknow|kanpur|patna|varanasi|agra|lahore|amritsar|ludhiana|kolkata|dhaka|allahabad|prayagraj/i;

export function sourcesFor(locationName: string): SourceProfile {
  if (DELHI_RE.test(locationName)) return DELHI_NCR;
  if (IGP_RE.test(locationName)) return INDO_GANGETIC;
  return GENERIC;
}
