type Stop = { name: string; code: string; route: string };

// One example per area from CityBus's published GTFS feed (2026.3.5).
// Source: https://bus.gocitybus.com/GTFSRT/citybus-lafayette-in-us.zip
const stops = new Map<string, Stop>([
  ["Purdue campus", { name: "Lilly Hall shelter on Mitch Daniels Boulevard", code: "BUS345", route: "43" }],
  ["Chauncey / New Chauncey", { name: "Stadium and Vine, northeast corner", code: "BUS647", route: "22" }],
  ["Wabash Landing / Levee", { name: "Wabash Landing shelter on State Street", code: "BUS156", route: "41" }],
  ["University Farm / Happy Hollow", { name: "Nobb Hill Apartments on Happy Hollow Road, west side", code: "BUS123W", route: "42" }],
  ["Faith West / Northwestern & Lindberg", { name: "Faith West Community Center", code: "5967", route: "21" }],
  ["University Crossing / Soldiers Home Road", { name: "University Crossing shelter on Soldiers Home Road", code: "BUS144", route: "42" }],
  ["North West Lafayette", { name: "Cumberland Pointe on Cumberland Avenue, north side", code: "BUS594", route: "22" }],
  ["Purdue Research Park", { name: "Kurz Technology Center on McClure Avenue", code: "BUS048", route: "43" }],
  ["Blackbird Farms / Lindberg", { name: "Lindberg and Kestral, northeast corner", code: "BUS205", route: "21" }],
  ["Cason Park / West Cumberland", { name: "The Lodge shelter on Cumberland Avenue", code: "BUS223", route: "52E" }],
  ["West State Street / Discovery Park", { name: "Aspire Apartments at Discovery Park", code: "BUS011", route: "41" }],
  ["Downtown Lafayette", { name: "CityBus Center on North 3rd Street", code: "BUS215", route: "21" }],
  ["Centennial / North Riverfront", { name: "9th and Roberts, northwest corner", code: "BUS987NW", route: "11" }],
  ["Wabash Avenue / South Riverfront", { name: "4th and Owen, northwest corner", code: "BUS399", route: "14" }],
]);

export function CityBusHint({ area }: { area: string }) {
  const stop = stops.get(area);
  if (!stop) {
    return <a href="https://bus.gocitybus.com/" target="_blank" rel="noreferrer">Find a CityBus stop</a>;
  }
  // The official Cumberland Express schedule retains a legacy URL.
  const routePath = stop.route === "52E" ? "13-silver-loop" : stop.route;
  return (
    <span className="citybus-hint">
      CityBus serves {stop.name} (stop {stop.code}).{" "}
      <a href={`https://www.in.gov/citybuslafayette/route/${routePath}`} target="_blank" rel="noreferrer">
        Route {stop.route} schedule
      </a>
      {stop.route === "52E" && " · Weekdays during Purdue’s fall and spring terms. Bring an eligible resident ID or pay the express fare."}
    </span>
  );
}
