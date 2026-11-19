/**
 * Every coefficient used by the impact engine, with its source. Keeping them in one file makes the
 * "Explain this number" panel honest: the UI renders these exact values and citations.
 */

export interface Sourced<T> {
  value: T;
  source: string;
}

/** Inhalation rates (m³/h) by activity, adult baseline. US EPA Exposure Factors Handbook (2011), ch. 6. */
export const BREATHING_M3H = {
  sleep: { value: 0.3, source: "US EPA Exposure Factors Handbook 2011, Table 6-2" },
  light: { value: 0.7, source: "US EPA Exposure Factors Handbook 2011, Table 6-2" },
  moderate: { value: 1.6, source: "US EPA Exposure Factors Handbook 2011, Table 6-2" },
} as const satisfies Record<string, Sourced<number>>;

/** Relative inhalation rate per age group vs adult (EPA EFH 2011, age-specific tables, rounded). */
export const AGE_BREATHING_FACTOR = { child: 0.85, adult: 1, senior: 0.95 } as const;

/**
 * Indoor mass-balance model (steady state): C_in = P·a·C_out / (a + k + CADR/V).
 * P = penetration, a = air exchange (1/h), k = deposition (1/h). Riley et al. 2002, Atmos. Environ.
 */
export const INDOOR = {
  penetration: { value: 0.8, source: "Riley et al. 2002, Atmospheric Environment 36:2" },
  depositionPerH: { value: 0.2, source: "Riley et al. 2002, Atmospheric Environment 36:2" },
  airExchangeOpenPerH: {
    value: 3,
    source: "Typical naturally ventilated Indian home, windows open (ASHRAE 2017 range)",
  },
  airExchangeClosedPerH: { value: 0.8, source: "Typical leaky home, windows shut (ASHRAE 2017 range)" },
} as const;

/** Clean-air delivery rate of a DIY box-fan + MERV-13 filter (single filter). Derived from Dal Porto et al. 2022. */
export const DIY_FAN_FILTER_CADR = {
  value: 250,
  source: "Dal Porto et al. 2022, Aerosol and Air Quality Research",
};

/** Microenvironment multipliers relative to ambient PM2.5. */
export const MICRO = {
  car: { value: 0.75, source: "Kumar & Gupta 2016, Delhi in-car PM2.5 with windows closed" },
  two_wheeler: { value: 1.25, source: "Goel et al. 2015, Delhi on-road PM2.5 exposure by mode" },
  bus: { value: 1.1, source: "Goel et al. 2015, Delhi on-road PM2.5 exposure by mode" },
  metro: { value: 0.65, source: "Goel et al. 2015, Delhi on-road PM2.5 exposure by mode" },
  walk_cycle: { value: 1.2, source: "Goel et al. 2015, Delhi on-road PM2.5 exposure by mode" },
  workplace: { value: 0.65, source: "Office buildings with central HVAC (indoor/outdoor ratio ~0.6–0.7)" },
  school: { value: 0.8, source: "Naturally ventilated classrooms, I/O ratio ~0.8 (Goyal & Khare 2009)" },
} as const;

/** Extra indoor PM2.5 (µg/m³, hour-averaged) from household sources. */
export const INDOOR_SOURCES = {
  lpg: { value: 20, source: "Balakrishnan et al. 2013, kitchen PM2.5 in LPG homes" },
  induction: { value: 4, source: "Electric cooking, frying aerosol only" },
  kerosene: { value: 90, source: "Balakrishnan et al. 2013" },
  biomass: { value: 300, source: "Balakrishnan et al. 2013, chulha kitchens" },
  incenseOrCoil: {
    value: 40,
    source: "Liu et al. 2003, Environ. Health Perspect. (one coil ≈ 75–137 cigarettes of PM)",
  },
  exhaustReduction: { value: 0.6, source: "Range-hood capture efficiency (Lunden et al. 2015)" },
} as const;

/** Respirator protection factors (fraction of PM2.5 removed in real-world wear). */
export const MASK_REDUCTION = {
  n95: { value: 0.7, source: "Cherrie et al. 2018, Occup. Environ. Med. (real-world fit, Beijing)" },
} as const;

/** Per-passenger-km emission factors. CO₂ in kg/km, PM2.5 (exhaust + non-exhaust) in g/km. */
export const EMISSIONS = {
  car: { co2: 0.15, pm25: 0.012, source: "ARAI 2008 Indian EFs; EEA 2023 non-exhaust guidebook" },
  two_wheeler: { co2: 0.045, pm25: 0.01, source: "ARAI 2008 Indian EFs" },
  bus: { co2: 0.03, pm25: 0.002, source: "ARAI 2008, per passenger at typical occupancy" },
  metro: { co2: 0.025, pm25: 0.0004, source: "DMRC 2019 sustainability report, grid EF 0.71 kg/kWh" },
  walk_cycle: { co2: 0, pm25: 0, source: "Zero tailpipe emissions" },
  wfh: { co2: 0, pm25: 0, source: "No trip" },
} as const;

/** Open burning of leaves/waste: PM2.5 emitted per kg burned, assumed household weekly quantity. */
export const OPEN_BURNING = {
  pm25GPerKg: { value: 8, source: "Akagi et al. 2011, Atmos. Chem. Phys. (garden waste open burning)" },
  kgPerWeek: { value: 3, source: "Assumed household leaf/waste pile" },
};

/** Cooking-fuel CO₂ per week for an average Indian household. */
export const COOKING_CO2_KG_WEEK = {
  lpg: { value: 7.3, source: "0.35 kg LPG/day × 2.98 kg CO₂/kg (IPCC 2006)" },
  induction: { value: 6.0, source: "1.2 kWh/day × 0.71 kg CO₂/kWh (CEA 2023 grid EF)" },
  kerosene: { value: 9.5, source: "IPCC 2006 default EF" },
  biomass: { value: 0, source: "Biogenic CO₂ treated as neutral (IPCC); health impact dominates" },
} as const;
