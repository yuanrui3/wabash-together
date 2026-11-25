import { AREAS } from "./community";

type Area = (typeof AREAS)[number];
type Connection = readonly [Area, Area, miles: number];

// Approximate driving miles between public neighborhood reference points.
// River crossings use the vehicle bridges. The pedestrian bridge is omitted.
const connections: readonly Connection[] = [
  ["Purdue campus", "Chauncey / New Chauncey", .6],
  ["Purdue campus", "West State Street / Discovery Park", .9],
  ["Purdue campus", "North West Lafayette", 2.3],
  ["Purdue campus", "Blackbird Farms / Lindberg", 1.8],
  ["Faith West / Northwestern & Lindberg", "Blackbird Farms / Lindberg", .9],
  ["Faith West / Northwestern & Lindberg", "Purdue campus", 1.9],
  ["Faith West / Northwestern & Lindberg", "Purdue Research Park", 1.6],
  ["University Crossing / Soldiers Home Road", "University Farm / Happy Hollow", 1.4],
  ["University Crossing / Soldiers Home Road", "North West Lafayette", 1.6],
  ["Soldiers Home Road / Kalberer Road", "University Crossing / Soldiers Home Road", 1.1],
  ["Soldiers Home Road / Kalberer Road", "North West Lafayette", 1.4],
  ["Blackbird Farms / Lindberg", "Cason Park / West Cumberland", 1.2],
  ["Blackbird Farms / Lindberg", "Purdue Research Park", 1.8],
  ["Cason Park / West Cumberland", "Purdue Research Park", 1.4],
  ["Purdue Research Park", "North West Lafayette", .8],
  ["Chauncey / New Chauncey", "Wabash Landing / Levee", .8],
  ["Chauncey / New Chauncey", "University Farm / Happy Hollow", 1.2],
  ["University Farm / Happy Hollow", "North West Lafayette", 1.4],
  ["University Farm / Happy Hollow", "Wabash Landing / Levee", 1.5],
  ["University Farm / Happy Hollow", "Centennial / North Riverfront", 1.9],
  ["Wabash Landing / Levee", "Downtown Lafayette", 1.0],
  ["Wabash Landing / Levee", "Centennial / North Riverfront", 1.2],
  ["Downtown Lafayette", "Centennial / North Riverfront", .6],
  ["Downtown Lafayette", "Wabash Avenue / South Riverfront", .9],
  ["Wabash Landing / Levee", "Wabash Avenue / South Riverfront", 1.6],
  ["West State Street / Discovery Park", "Wabash Landing / Levee", 1.6],
];

const areaIndices = new Map<string, number>(AREAS.map((area, index) => [area, index]));
const milesBetween = AREAS.map((_, from) => AREAS.map((_, to) => from === to ? 0 : Infinity));

for (const [from, to, miles] of connections) {
  const i = AREAS.indexOf(from);
  const j = AREAS.indexOf(to);
  milesBetween[i][j] = milesBetween[j][i] = miles;
}
for (let via = 0; via < AREAS.length; via += 1) {
  for (let from = 0; from < AREAS.length; from += 1) {
    for (let to = 0; to < AREAS.length; to += 1) {
      milesBetween[from][to] = Math.min(milesBetween[from][to], milesBetween[from][via] + milesBetween[via][to]);
    }
  }
}

export function areaMiles(from: string, to: string): number | null {
  const i = areaIndices.get(from);
  const j = areaIndices.get(to);
  if (i === undefined || j === undefined) return null;
  const miles = milesBetween[i][j];
  return Number.isFinite(miles) ? miles : null;
}

export function estimateRide(driverStart: string, driverEnd: string, riderStart: string, riderEnd: string) {
  const [from, to, pickUp, dropOff] = [driverStart, driverEnd, riderStart, riderEnd].map((area) => areaIndices.get(area));
  if (from === undefined || to === undefined || pickUp === undefined || dropOff === undefined) return null;
  const pickup = milesBetween[from][pickUp];
  const shared = milesBetween[pickUp][dropOff];
  const direct = milesBetween[from][to];
  const combined = pickup + shared + milesBetween[dropOff][to];
  return { pickup, shared, detour: Math.max(0, combined - direct) };
}
