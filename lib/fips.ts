const STATES = [
  ["AL", "01", "Alabama"],
  ["AK", "02", "Alaska"],
  ["AS", "60", "American Samoa"],
  ["AZ", "04", "Arizona"],
  ["AR", "05", "Arkansas"],
  ["CA", "06", "California"],
  ["CO", "08", "Colorado"],
  ["CT", "09", "Connecticut"],
  ["DE", "10", "Delaware"],
  ["DC", "11", "District of Columbia"],
  ["FL", "12", "Florida"],
  ["GA", "13", "Georgia"],
  ["GU", "66", "Guam"],
  ["HI", "15", "Hawaii"],
  ["ID", "16", "Idaho"],
  ["IL", "17", "Illinois"],
  ["IN", "18", "Indiana"],
  ["IA", "19", "Iowa"],
  ["KS", "20", "Kansas"],
  ["KY", "21", "Kentucky"],
  ["LA", "22", "Louisiana"],
  ["ME", "23", "Maine"],
  ["MD", "24", "Maryland"],
  ["MA", "25", "Massachusetts"],
  ["MI", "26", "Michigan"],
  ["MN", "27", "Minnesota"],
  ["MS", "28", "Mississippi"],
  ["MO", "29", "Missouri"],
  ["MT", "30", "Montana"],
  ["NE", "31", "Nebraska"],
  ["NV", "32", "Nevada"],
  ["NH", "33", "New Hampshire"],
  ["NJ", "34", "New Jersey"],
  ["NM", "35", "New Mexico"],
  ["NY", "36", "New York"],
  ["NC", "37", "North Carolina"],
  ["ND", "38", "North Dakota"],
  ["MP", "69", "Northern Mariana Islands"],
  ["OH", "39", "Ohio"],
  ["OK", "40", "Oklahoma"],
  ["OR", "41", "Oregon"],
  ["PA", "42", "Pennsylvania"],
  ["PR", "72", "Puerto Rico"],
  ["RI", "44", "Rhode Island"],
  ["SC", "45", "South Carolina"],
  ["SD", "46", "South Dakota"],
  ["TN", "47", "Tennessee"],
  ["TX", "48", "Texas"],
  ["UM", "74", "U.S. Minor Outlying Islands"],
  ["UT", "49", "Utah"],
  ["VT", "50", "Vermont"],
  ["VA", "51", "Virginia"],
  ["VI", "78", "U.S. Virgin Islands"],
  ["WA", "53", "Washington"],
  ["WV", "54", "West Virginia"],
  ["WI", "55", "Wisconsin"],
  ["WY", "56", "Wyoming"],
] as const;

export type StateCode = (typeof STATES)[number][0];

export const STATE_FIPS_BY_CODE = Object.fromEntries(
  STATES.map(([code, fips]) => [code, fips]),
) as Record<StateCode, string>;

export const STATE_CODE_BY_FIPS = Object.fromEntries(
  STATES.map(([code, fips]) => [fips, code]),
) as Record<string, StateCode>;

export const STATE_NAME_BY_CODE = Object.fromEntries(
  STATES.map(([code, , name]) => [code, name]),
) as Record<StateCode, string>;

export function normalizeStateCode(value: string | undefined | null): StateCode | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  return normalized in STATE_FIPS_BY_CODE ? (normalized as StateCode) : undefined;
}

export function stateFipsFromCode(code: string | undefined | null): string | undefined {
  const normalized = normalizeStateCode(code);
  return normalized ? STATE_FIPS_BY_CODE[normalized] : undefined;
}

export function stateCodeFromFips(fips: string | number | undefined | null): StateCode | undefined {
  if (fips === undefined || fips === null) {
    return undefined;
  }

  const normalized = String(fips).padStart(2, "0");
  return STATE_CODE_BY_FIPS[normalized];
}

export function stateNameFromCode(code: string | undefined | null): string | undefined {
  const normalized = normalizeStateCode(code);
  return normalized ? STATE_NAME_BY_CODE[normalized] : undefined;
}

export function stateCodeFromName(name: string | undefined | null): StateCode | undefined {
  if (!name) {
    return undefined;
  }

  const normalized = name.trim().toLowerCase();
  const match = STATES.find(([, , stateName]) => stateName.toLowerCase() === normalized);
  return match?.[0];
}
