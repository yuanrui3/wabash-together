export const AREAS = [
  "Purdue campus",
  "Chauncey / New Chauncey",
  "Wabash Landing / Levee",
  "University Farm / Happy Hollow",
  "Faith West / Northwestern & Lindberg",
  "University Crossing / Soldiers Home Road",
  "Soldiers Home Road / Kalberer Road",
  "North West Lafayette",
  "Purdue Research Park",
  "Blackbird Farms / Lindberg",
  "Cason Park / West Cumberland",
  "West State Street / Discovery Park",
  "Downtown Lafayette",
  "Centennial / North Riverfront",
  "Wabash Avenue / South Riverfront",
] as const;

export const MAX_ACTIVE_POSTS = 10;
export const MAX_POSTS_PER_24_HOURS = 10;
export const POSTING_LIMITS = `You can have up to ${MAX_ACTIVE_POSTS} active posts and publish up to ${MAX_POSTS_PER_24_HOURS} new posts in any 24 hours.`;

// Names follow Purdue Parking Operations and the West Lafayette campus map.
export const PURDUE_PARKING = [
  "Co-Rec lot", "Discovery Park lot", "Ross-Ade Stadium lot",
  "Grant Street Parking Garage", "Harrison Street Parking Garage",
  "Northwestern Avenue Parking Garage", "University Street Parking Garage",
  "Wood Street Parking Garage",
] as const;

export function usesCampusParking(kind: string, destination: unknown) {
  return kind === "carpool" && destination === "Purdue campus";
}

export const OUTSIDE_AREA = "outside-listed-areas";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const TERMS_VERSION = "2026-11-24";

export type Kind = "carpool" | "oneoff" | "carshare";
export type Role = "offer" | "request";

export interface Listing {
  id: string;
  kind: Kind;
  role: Role;
  title: string;
  area: string;
  destination: string;
  parkingLot: string;
  days: string[];
  date: string;
  start: string;
  end: string;
  note: string;
  name: string;
  purdue: boolean;
  nearCityBus: boolean;
  expires: number;
}

export interface Intro {
  id: string;
  listingId: string;
  title: string;
  direction: "sent" | "received";
  name: string;
  note: string;
  status: "pending" | "accepted" | "declined";
  contact: string | null;
}

export interface Community {
  user: { name: string; purdueEmail: boolean } | null;
  listings: Listing[];
  own: Listing[];
  intros: Intro[];
}
