import { AREAS } from "./community";

type Candidate = [areaIndex: number, city: "W" | "L", zip: string];

export type AddressIndex = {
  areas: string[];
  streets: Record<string, Record<string, Candidate[]>>;
  source?: string;
};

type Result =
  | { kind: "found"; area: string }
  | { kind: "incomplete" | "missing" | "ambiguous" };

const knownAreas = new Set<string>(AREAS);

const roadTokens = new Map(Object.entries({
  north: "n", south: "s", east: "e", west: "w",
  northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw",
  road: "rd", street: "st", avenue: "ave", boulevard: "blvd",
  drive: "dr", place: "pl", court: "ct", lane: "ln", circle: "cir",
  parkway: "pkwy", terrace: "ter", trail: "trl", highway: "hwy", square: "sq", trace: "trce",
  first: "1st", second: "2nd", third: "3rd", fourth: "4th", fifth: "5th",
  sixth: "6th", seventh: "7th", eighth: "8th", ninth: "9th", tenth: "10th",
  eleventh: "11th", twelfth: "12th", thirteenth: "13th", fourteenth: "14th", fifteenth: "15th",
  sixteenth: "16th", seventeenth: "17th", eighteenth: "18th", nineteenth: "19th", twentieth: "20th",
}));

export function normalizeStreet(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/['’.]/g, "").replace(/[^a-z0-9 ]/g, " ").trim().split(/\s+/)
    .map(token => roadTokens.get(token) ?? token).join(" ");
}

function trimSeparators(value: string): string {
  return value.replace(/^[\s,]+|[\s,]+$/g, "");
}

function parseAddress(value: string) {
  if (!value.trim() || value.length > 220) return null;
  // Remove only the unit designator and its identifier; keep the city and ZIP
  // that follow it so they can disambiguate or rule out an apparent match.
  let rest = trimSeparators(value.normalize("NFKC").replace(/[\r\n]+/g, ", ")
    .replace(/(?:\b(?:apartment|apt|unit|suite|ste|room|rm)(?=[.\s#0-9])\.?\s*#?\s*|(?:^|[\s,])#\s*)[a-z0-9]+(?:[-/][a-z0-9]+)*\b/gi, " ")
    .replace(/(?:,|\s)+(?:united states(?: of america)?|u\.?s\.?a?\.?)\s*$/i, ""));
  const zipMatch = rest.match(/(?:,|\s)+(\d{5})(?:-\d{4})?$/);
  if (zipMatch) rest = trimSeparators(rest.slice(0, zipMatch.index));
  rest = trimSeparators(rest.replace(/(?:,|\s)+(?:in\.?|indiana)$/i, ""));
  const cityMatch = rest.match(/(?:,|\s)+((?:west\s+|w\.?\s+)lafayette|lafayette)$/i);
  const city = cityMatch ? (/^w/i.test(cityMatch[1]) ? "W" : "L") : undefined;
  if (cityMatch) rest = trimSeparators(rest.slice(0, cityMatch.index));

  const address = rest.match(/^(\d{1,7}(?:-?[a-z]|-\d+[a-z]?)?)\s+([^,]+)(?:,\s*(.+))?$/i);
  if (!address) return null;
  const street = normalizeStreet(address[2]);
  if (!street || !/[a-z]/.test(street)) return null;
  return { number: address[1].toLowerCase().replace(/-/g, ""), street, city, zip: zipMatch?.[1], otherLocality: Boolean(address[3]) };
}

export function findAddress(value: string, index: AddressIndex): Result {
  const address = parseAddress(value);
  if (!address) return { kind: "incomplete" };
  if (address.otherLocality) return { kind: "missing" };
  const road = Object.hasOwn(index.streets, address.street) ? index.streets[address.street] : undefined;
  const candidates = road && Object.hasOwn(road, address.number) ? road[address.number] : [];
  const choices = new Set<string>();
  for (const [areaIndex, city, zip] of candidates) {
    if (address.city && address.city !== city) continue;
    if (address.zip && address.zip !== zip) continue;
    const area = index.areas[areaIndex];
    if (knownAreas.has(area)) choices.add(area);
  }
  if (choices.size === 1) return { kind: "found", area: [...choices][0] };
  return { kind: choices.size ? "ambiguous" : "missing" };
}
