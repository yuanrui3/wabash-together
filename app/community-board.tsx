"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AREAS, DAYS, OUTSIDE_AREA, POSTING_LIMITS, TERMS_VERSION, type Community, type Intro, type Kind, type Listing, type Role,
} from "../lib/community";
import { areaMiles, estimateRide } from "../lib/ride-distance";
import { AreaField, AreaPickerMap, useAreaPicker } from "./area-picker";
import { CityBusHint } from "./citybus-hint";

type Pane = "board" | "post" | "connections";
type DialogState =
  | { type: "request" | "report" | "remove"; listing: Listing }
  | { type: "accept"; intro: Intro };

type BoardLinks = {
  signIn: string;
  postSignIn: string;
  connectionsSignIn: string;
};

type ListingFields = Pick<
  Listing, "kind" | "role" | "title" | "area" | "destination" | "days" | "date" | "start" | "end" | "note" | "purdue" | "nearCityBus"
>;

type Mutation =
  | ({ action: "create"; termsVersion: string } & ListingFields)
  | ({ action: "update"; id: string; termsVersion: string } & ListingFields)
  | { action: "remove"; id: string }
  | { action: "request"; id: string; note: string; termsVersion: string }
  | { action: "report"; id: string; reason: string }
  | { action: "respond"; id: string; decision: "accept"; termsVersion: string }
  | { action: "respond"; id: string; decision: "decline" };

type RideMetrics = NonNullable<ReturnType<typeof estimateRide>>;
const kinds = ["carpool", "oneoff", "carshare"] as const;
const kindLabels: Record<Kind, string> = {
  carpool: "Recurring carpools", oneoff: "One-time rides", carshare: "Car sharing",
};
const roleLabels: Record<Kind, Record<Role, string>> = {
  carpool: { offer: "Offering a ride", request: "Looking for a ride" },
  oneoff: { offer: "Offering seats", request: "Looking for a seat" },
  carshare: { offer: "Offering car access", request: "Looking for car access" },
};
const defaultDetour = "3";

function readPane(): Pane {
  switch (window.location.hash.split("?")[0]) {
    case "#post": return "post";
    case "#connections": return "connections";
    default: return "board";
  }
}

// Only broad, selectable fields are carried from an empty search into a post.
function readPostSeed(fragment: string) {
  const query = new URLSearchParams(fragment.split("?")[1]);
  const kind = kinds.find(value => value === query.get("kind"));
  if (!kind) return null;
  const role: Role = query.get("role") === "offer" ? "offer" : "request";
  const area = AREAS.find(value => value === query.get("area")) ?? "";
  const destination = AREAS.find(value => value === query.get("destination")) ?? "";
  const day = DAYS.find(value => value === query.get("day")) ?? "";
  const tripDate = query.get("date") ?? "";
  return { kind, role, area, destination, day, date: /^\d{4}-\d{2}-\d{2}$/.test(tripDate) ? tripDate : "" };
}

function postFragment(seed: NonNullable<ReturnType<typeof readPostSeed>>) {
  const params = new URLSearchParams();
  for (const [field, value] of Object.entries(seed)) if (value) params.set(field, value);
  return "#post?" + params.toString();
}

function formatTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "a.m." : "p.m."}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

function miles(value: number) {
  return `${value.toFixed(1)} mi`;
}

export function CommunityBoard({ signIn, postSignIn, connectionsSignIn }: BoardLinks) {
  const [data, setData] = useState<Community | null>(null);
  const [loadError, setLoadError] = useState("");
  const [pane, setPane] = useState<Pane>("board");
  const [kind, setKind] = useState<Kind>("carpool");
  const [area, setArea] = useState("");
  const [destination, setDestination] = useState("");
  const picker = useAreaPicker("browse", kind, area, destination, setArea, setDestination);
  const [role, setRole] = useState("");
  const [day, setDay] = useState("");
  const [date, setDate] = useState("");
  const [detour, setDetour] = useState(defaultDetour);
  const [busOnly, setBusOnly] = useState(false);
  const [postSeed, setPostSeed] = useState<ReturnType<typeof readPostSeed>>(null);
  const [purdueOnly, setPurdueOnly] = useState(false);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const loadNumber = useRef(0);
  const navPending = useRef(false);

  useEffect(() => {
    function syncPane() {
      const next = readPane();
      navPending.current = next !== "board";
      setPane(next);
      setPostSeed(next === "post" ? readPostSeed(window.location.hash) : null);
      if (next !== "post") setEditing(null);
      setActionError("");
    }
    syncPane();
    window.addEventListener("hashchange", syncPane);
    return () => window.removeEventListener("hashchange", syncPane);
  }, []);

  useEffect(() => {
    if (pane !== "board" && navPending.current) {
      navPending.current = false;
      document.getElementById(pane)?.scrollIntoView({ block: "start" });
    }
  }, [pane]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const current = ++loadNumber.current;
    setLoadError("");
    try {
      const response = await fetch("/api/community", { cache: "no-store", signal });
      if (!response.ok) throw new Error();
      const responseData: Community = await response.json();
      if (current === loadNumber.current) setData(responseData);
    } catch {
      if (!signal?.aborted && current === loadNumber.current) {
        setLoadError("The community board could not load. Please try again.");
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  function newPost() {
    setEditing(null);
    setActionError("");
  }

  function editPost(listing: Listing) {
    setEditing(listing);
    setActionError("");
    window.location.hash = "post";
  }

  function openDialog(next: DialogState) {
    setDialog(next);
    setActionError("");
    setNotice("");
  }

  async function mutate(body: Mutation, success: string) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setNotice("");
    setActionError("");
    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      const payload = result && typeof result === "object" ? result : {};
      if (!response.ok || !("ok" in payload) || payload.ok !== true) {
        const error = "error" in payload ? payload.error : null;
        setActionError(typeof error === "string" ? error : "This action could not be completed. Please try again.");
        return false;
      }
      setDialog(null);
      setNotice(success);
      await refresh();
      return true;
    } catch {
      setActionError("The site could not confirm this change. Refresh the board to check before retrying.");
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const outside = area === OUTSIDE_AREA || destination === OUTSIDE_AREA;
  const hasRoute = !outside && kind === "oneoff" && area !== "" && destination !== "" && area !== destination;
  const matching = data?.listings.filter(listing =>
    listing.kind === kind &&
    (!role || listing.role === role) &&
    (!busOnly || listing.nearCityBus) &&
    (!purdueOnly || listing.purdue) &&
    (kind === "carshare" || hasRoute || !destination || destination === OUTSIDE_AREA || listing.destination === destination) &&
    (!day || listing.days.includes(day)) &&
    (!date || listing.date === date),
  ) ?? [];
  const displayed = matching
    .map(listing => ({
      listing,
      route: !hasRoute ? null : listing.role === "offer"
        ? estimateRide(listing.area, listing.destination, area, destination)
        : estimateRide(area, destination, listing.area, listing.destination),
    }))
    .filter(({ listing, route }) => hasRoute
      ? route !== null && (detour === "" || route.detour <= Number(detour) + 1e-6)
      : !area || area === OUTSIDE_AREA || listing.area === area);
  if (kind === "oneoff") {
    displayed.sort((a, b) => (a.route?.detour ?? 0) - (b.route?.detour ?? 0) ||
      a.listing.date.localeCompare(b.listing.date) || a.listing.start.localeCompare(b.listing.start));
  }
  const counts: Record<string, number> = Object.create(null);
  const mappedListings = hasRoute ? displayed.map(({ listing }) => listing) : matching;
  for (const listing of mappedListings) counts[listing.area] = (counts[listing.area] ?? 0) + 1;
  const existingOwn = new Set(data?.own.map(listing => listing.id));
  const requested = new Map(data?.intros.filter(intro => intro.direction === "sent").map(intro => [intro.listingId, intro]));

  function changeKind(next: Kind) {
    picker.reset();
    setKind(next);
    setRole("");
    setDestination("");
    setDay("");
    setDate("");
    setDetour(defaultDetour);
  }

  function clearFilters() {
    picker.reset();
    setArea("");
    setDestination("");
    setRole("");
    setDay("");
    setDate("");
    setDetour(defaultDetour);
    setPurdueOnly(false);
    setBusOnly(false);
  }

  const missingStart = area === OUTSIDE_AREA;
  const filtered = Boolean((area && !missingStart) || (destination && destination !== OUTSIDE_AREA) || role || day || date || purdueOnly || busOnly);
  const matchingPost = postFragment({
    kind, role: role === "request" ? "offer" : "request",
    area: missingStart ? "" : area,
    destination: destination === OUTSIDE_AREA ? "" : destination,
    day, date,
  });
  const guestPostLink = postSeed
    ? postSignIn.split("?")[0] + "?return_to=" + encodeURIComponent("/" + postFragment(postSeed))
    : postSignIn;
  const extraCount = Number(Boolean(role)) + Number(purdueOnly) + Number(busOnly) + Number(hasRoute && detour !== defaultDetour);
  return (
    <section id="board" className="community-board" aria-labelledby="community-board-title">
      <div className="board-heading">
        <div>
          <p className="board-overline">The community board</p>
          <h2 id="community-board-title">Find a neighbor going your way.</h2>
        </div>
        <nav className="board-nav" aria-label="Community board">
          <a href="#board" aria-current={pane === "board" ? "page" : undefined}>Browse</a>
          <a href="#connections" aria-current={pane === "connections" ? "page" : undefined}>My activity</a>
          <a href="#post" className="board-button is-primary" onClick={newPost} aria-current={pane === "post" ? "page" : undefined}>Post to the board</a>
        </nav>
      </div>

      {loadError && (
        <div className="board-notice is-error" role="alert">
          {loadError} <button type="button" className="board-button is-quiet" onClick={() => void refresh()}>Retry</button>
        </div>
      )}
      {notice && <p className="board-notice" role="status">{notice}</p>}
      {actionError && !dialog && pane !== "post" && <p className="board-notice is-error" role="alert">{actionError}</p>}

      {pane === "board" && (
        <div className="board-results">
          <div className="board-tabs" aria-label="Listing category" role="group">
            {kinds.map(option => (
              <button type="button" key={option} className={kind === option ? "is-active" : ""} aria-pressed={kind === option} onClick={() => changeKind(option)}>
                {kindLabels[option]}
              </button>
            ))}
          </div>

          <div className="board-filters">
            <AreaField picker={picker} field="pickup" placeholder="All areas"
              label={kind === "oneoff" ? "Local pickup area" : kind === "carpool" ? "Commute pickup area" : "Car pickup area"} />
            {kind !== "carshare" && <AreaField picker={picker} field="dropoff" placeholder="Any destination"
              label={kind === "oneoff" ? "Local drop-off area" : "Work area"} />}
            {kind === "carpool" && (
              <label>Day
                <select value={day} onChange={event => setDay(event.target.value)}>
                  <option value="">Any day</option>
                  {DAYS.map(value => <option key={value}>{value}</option>)}
                </select>
              </label>
            )}
            {kind === "oneoff" && (
              <label>Trip date<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
            )}
          </div>
          <details className="board-more-filters">
            <summary>More filters{extraCount ? ` (${extraCount} active)` : ""}</summary>
            <div className="board-filters">
              <label>Type
                <select value={role} onChange={event => setRole(event.target.value)}>
                  <option value="">Offers and requests</option>
                  <option value="offer">Offers</option>
                  <option value="request">Requests</option>
                </select>
              </label>
              {hasRoute && (
                <label>Maximum added miles
                  <select value={detour} onChange={event => setDetour(event.target.value)}>
                    <option value="1">1 mile</option><option value="3">3 miles</option>
                    <option value="5">5 miles</option><option value="">Any estimate</option>
                  </select>
                </label>
              )}
              <label className="board-purdue-filter">
                <input type="checkbox" checked={purdueOnly} onChange={event => setPurdueOnly(event.target.checked)} />
                Purdue email badge only
              </label>
              <label className="board-purdue-filter">
                <input type="checkbox" checked={busOnly} onChange={event => setBusOnly(event.target.checked)} />
                Can meet near CityBus
              </label>
            </div>
          </details>
          {kind === "oneoff" && !outside && (
            <p className="board-match-help">{hasRoute
              ? "Rides are sorted by estimated extra driving within the local route."
              : area && area === destination
                ? "For trips within one neighborhood, the board shows listings within that area."
                : "Choose the two areas you’ll travel between locally, even if your trip continues farther."}</p>
          )}

          <div className="board-browse-layout">
            <div>
              <AreaPickerMap picker={picker} counts={counts} comparingRoute={hasRoute} />
              <MeetingStops area={area} destination={destination} />
            </div>
            <div className="board-browse-list">
              {!data && !loadError && <div className="board-empty" role="status"><p>Loading local posts…</p></div>}
              {data && displayed.length === 0 && (
                <div className="board-empty">
                  {filtered ? <>
                    <h3>{hasRoute ? "No rides match this route and filters." : "No posts match these filters."}</h3>
                    <div className="board-card-actions">
                      <a className="board-button is-primary" href={matchingPost} onClick={newPost}>
                        {role === "request" ? "Post an offer" : "Post a request"}
                      </a>
                      <button type="button" className="board-button is-quiet" onClick={clearFilters}>Clear filters</button>
                    </div>
                  </> : <>
                    <h3>{kind === "carpool" ? "No carpools posted yet." : kind === "oneoff" ? "No one-time rides posted yet." : "No car-sharing posts yet."}</h3>
                    <p>{kind === "carpool"
                      ? "Offer a seat or post the commute you need."
                      : kind === "oneoff" ? "Offer a seat or post a trip you need a ride for." : "Offer car access or tell nearby owners what you’re looking for."}</p>
                    <a className="board-button is-primary" href={postFragment({kind, role: "offer", area: "", destination: "", day: "", date: ""})} onClick={newPost}>Add a {kind === "carpool" ? "carpool" : kind === "oneoff" ? "one-time ride" : "car-sharing"} post</a>
                  </>}
                </div>
              )}
              {displayed.length > 0 && <div className="board-grid">
                {displayed.map(({ listing, route }) => (
                  <ListingCard key={listing.id} listing={listing} route={route}>
                    {existingOwn.has(listing.id) ? (
                      <button type="button" className="board-button is-quiet" onClick={() => editPost(listing)}>Edit post</button>
                    ) : !data?.user ? (
                      <a className="board-button is-primary" href={signIn} target="_top">Sign in to connect</a>
                    ) : requested.has(listing.id) ? (
                      <a className="board-button is-quiet" href="#connections">View introduction</a>
                    ) : (
                      <button type="button" className="board-button is-primary" onClick={() => openDialog({ type: "request", listing })}>
                        Request introduction
                      </button>
                    )}
                    {data?.user && !existingOwn.has(listing.id) &&
                      <button type="button" className="board-button is-quiet" onClick={() => openDialog({ type: "report", listing })}>Report</button>}
                  </ListingCard>
                ))}
              </div>}
            </div>
          </div>
        </div>
      )}

      {pane === "post" && (
        <section id="post" className="board-panel" aria-labelledby="post-title">
          <h3 id="post-title">{editing ? "Edit your post" : "Post to the board"}</h3>
          {data?.user ? (
            <PostForm key={editing?.id ?? (postSeed ? postFragment(postSeed) : "new")} listing={editing} defaultKind={kind} seed={postSeed} purdueEligible={data.user.purdueEmail} busy={busy} error={actionError} onSubmit={async fields => {
              const saved = await mutate(
                editing
                  ? { action: "update", id: editing.id, termsVersion: TERMS_VERSION, ...fields }
                  : { action: "create", termsVersion: TERMS_VERSION, ...fields },
                editing ? "Your post was updated." : "Your post is live.",
              );
              if (saved) {
                setEditing(null);
                changeKind(fields.kind);
                clearFilters();
                window.location.hash = "board";
              }
            }} />
          ) : data ? (
            <>
              <SignInNotice href={guestPostLink}>Sign in to post a ride, request one, or find nearby car access.</SignInNotice>
              <p className="board-match-help">{POSTING_LIMITS}</p>
            </>
          ) : !loadError ? <p role="status">Loading…</p> : null}
        </section>
      )}

      {pane === "connections" && (
        <section id="connections" className="board-panel" aria-labelledby="activity-title">
          <h3 id="activity-title">My activity</h3>
          {data?.user ? (
            <>
              <h4>Introductions</h4>
              {data.intros.length === 0 ? (
                <p>Introductions you send and receive will appear here.</p>
              ) : (
                <div className="board-grid">
                  {data.intros.map(intro => (
                    <article className="board-card" key={intro.id}>
                      <div className="board-card-top">
                        <span className="board-tag">{intro.direction === "sent" ? "Sent" : "Received"}</span>
                        <span className="board-status">{intro.status === "pending" ? "Awaiting response" : intro.status === "accepted" ? "Accepted" : "Declined"}</span>
                      </div>
                      <h5>{intro.title}</h5>
                      <p>{intro.direction === "sent" ? "To" : "From"} {intro.name}</p>
                      {intro.note && <p className="board-note">{intro.note}</p>}
                      {intro.status === "accepted" && intro.contact && (
                        <div className="board-contact">
                          <p>Continue privately using this email.</p>
                          <a href={`mailto:${encodeURIComponent(intro.contact).replace("%40", "@")}`}>{intro.contact}</a>
                        </div>
                      )}
                      {intro.direction === "received" && intro.status === "pending" && (
                        <div className="board-card-actions">
                          <button type="button" className="board-button is-primary" disabled={busy} onClick={() => openDialog({ type: "accept", intro })}>Accept and share email</button>
                          <button type="button" className="board-button is-quiet" disabled={busy} onClick={() => void mutate({ action: "respond", id: intro.id, decision: "decline" }, "Introduction declined.")}>Decline</button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}

              <h4>My posts</h4>
              {data.own.length === 0 ? (
                <p>Posts you create will appear here. <a href="#post" onClick={newPost}>Create a post</a></p>
              ) : (
                <div className="board-grid">
                  {data.own.map(listing => (
                    <ListingCard key={listing.id} listing={listing} heading="h5">
                      <button type="button" className="board-button is-primary" onClick={() => editPost(listing)}>Edit post</button>
                      <button type="button" className="board-button is-quiet" onClick={() => openDialog({ type: "remove", listing })}>Remove post</button>
                    </ListingCard>
                  ))}
                </div>
              )}
            </>
          ) : data ? (
            <SignInNotice href={connectionsSignIn}>Sign in to review your introductions and manage your posts.</SignInNotice>
          ) : !loadError ? <p role="status">Loading…</p> : null}
        </section>
      )}

      {dialog && <ActionDialog
        action={dialog}
        busy={busy}
        error={actionError}
        onClose={() => { setDialog(null); setActionError(""); }}
        onSubmit={async value => {
          switch (dialog.type) {
            case "accept": return mutate({ action: "respond", id: dialog.intro.id, decision: "accept", termsVersion: TERMS_VERSION }, "Introduction accepted. You can now use the contact email.");
            case "remove": return mutate({ action: "remove", id: dialog.listing.id }, "Post removed.");
            case "report": return mutate({ action: "report", id: dialog.listing.id, reason: value }, "Report submitted.");
            case "request": return mutate({ action: "request", id: dialog.listing.id, note: value, termsVersion: TERMS_VERSION }, "Introduction requested.");
          }
        }}
      />}
    </section>
  );
}

function MeetingStops({ area, destination }: { area: string; destination: string }) {
  const pickup = area !== OUTSIDE_AREA && area;
  const dropoff = destination !== OUTSIDE_AREA && destination !== area && destination;
  if (!pickup && !dropoff) return null;
  return (
    <details className="board-stops">
      <summary>{dropoff ? "CityBus stops for this trip" : "CityBus near pickup"}</summary>
      {pickup && <p><strong>Pickup area</strong> · <CityBusHint area={pickup} /></p>}
      {dropoff && <p><strong>Drop-off area</strong> · <CityBusHint area={dropoff} /></p>}
      <p>Check service for your travel time. Agree on a nearby meeting spot and leave the bus boarding area clear.</p>
    </details>
  );
}

function SignInNotice({ href, children }: { href: string; children: ReactNode }) {
  return (
    <div className="board-empty">
      <p>{children}</p>
      <a href={href} target="_top" className="board-button is-primary">Sign in with ChatGPT</a>
    </div>
  );
}

function ListingCard({ listing, children, route, heading: Heading = "h3" }: {
  listing: Listing;
  children: ReactNode;
  route?: RideMetrics | null;
  heading?: "h3" | "h5";
}) {
  const localMiles = listing.kind === "oneoff" ? areaMiles(listing.area, listing.destination) : null;
  return (
    <article className="board-card">
      <div className="board-card-top">
        <span className="board-tag">{roleLabels[listing.kind][listing.role]}</span>
        {listing.purdue && <span className="board-tag is-purdue">Purdue email</span>}
        <span className="board-status">{kindLabels[listing.kind]}</span>
      </div>
      <Heading>{listing.title}</Heading>
      <ul className="board-meta">
        <li>{listing.area}{listing.destination ? ` to ${listing.destination}` : ""}</li>
        {listing.nearCityBus && <li>Can meet near a CityBus stop</li>}
        {listing.days.length > 0 && <li>{listing.days.join(" · ")}</li>}
        {listing.date && listing.start && <li>{formatDate(listing.date)} · Leave {formatTime(listing.start)}</li>}
        {listing.start && listing.end && (
          <li>Leave {formatTime(listing.start)} · Return {formatTime(listing.end)}</li>
        )}
      </ul>
      {route ? (
        <p className="board-route"><strong>Est. {miles(route.detour)} added locally</strong> · {route.pickup ? `${miles(route.pickup)} to pickup` : "pickup in starting area"} · {route.shared ? `${miles(route.shared)} shared` : "ride within one area"}</p>
      ) : localMiles !== null && (
        <p className="board-route">{localMiles ? `Est. ${miles(localMiles)} between local areas` : "Within one area · mileage depends on meeting points"}</p>
      )}
      {listing.nearCityBus && <MeetingStops area={listing.area} destination={listing.destination} />}
      {listing.note && <p className="board-note">{listing.note}</p>}
      <p className="board-byline">Posted by {listing.name}</p>
      <div className="board-card-actions">{children}</div>
    </article>
  );
}

function PostForm({ listing, defaultKind, seed, purdueEligible, busy, error, onSubmit }: {
  listing: Listing | null;
  defaultKind: Kind;
  seed: ReturnType<typeof readPostSeed>;
  purdueEligible: boolean;
  busy: boolean;
  error: string;
  onSubmit: (fields: ListingFields) => Promise<void>;
}) {
  const [kind, setKind] = useState<Kind>(listing?.kind ?? seed?.kind ?? defaultKind);
  const [role, setRole] = useState<Role>(listing?.role ?? seed?.role ?? "offer");
  const [area, setArea] = useState(listing?.area ?? seed?.area ?? "");
  const [destination, setDestination] = useState(listing?.destination ?? seed?.destination ?? "");
  const [days, setDays] = useState(listing?.days ?? (seed?.day ? [seed.day] : []));
  const [validation, setValidation] = useState("");
  const outside = area === OUTSIDE_AREA || (kind !== "carshare" && destination === OUTSIDE_AREA);

  const picker = useAreaPicker("post", kind, area, destination, setArea, setDestination);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (outside) return;
    if (kind === "carpool" && !days.length) {
      setValidation("Choose at least one commute day.");
      return;
    }
    setValidation("");
    const form = new FormData(event.currentTarget);
    void onSubmit({
      kind, role, area,
      title: String(form.get("title") ?? "").trim(),
      destination: kind === "carshare" ? "" : destination,
      days: kind === "oneoff" ? [] : DAYS.filter(day => days.includes(day)),
      date: kind === "oneoff" ? String(form.get("date") ?? "") : "",
      start: kind === "carshare" ? "" : String(form.get("start") ?? ""),
      end: kind === "carpool" ? String(form.get("end") ?? "") : "",
      note: String(form.get("note") ?? "").trim(),
      nearCityBus: form.has("nearCityBus"),
      purdue: purdueEligible && form.has("purdue"),
    });
  }

  return (
    <form className="board-form" onSubmit={submit}>
      <p>{kind === "oneoff" ? role === "offer" ? "Driving farther? Post the local stretch you can share and the time you reach it." : "Choose where you can get in and where you want to get out locally." : "Choose an area where you can meet, even if you live elsewhere."} Agree on the exact spot privately.</p>
      <div className="board-form-grid">
        <label>Category
          <select value={kind} onChange={event => { picker.reset(); setKind(event.target.value as Kind); }}>
            {kinds.map(option => <option key={option} value={option}>{kindLabels[option]}</option>)}
          </select>
        </label>
        <label>I’m…
          <select value={role} onChange={event => setRole(event.target.value as Role)}>
            <option value="offer">{roleLabels[kind].offer}</option>
            <option value="request">{roleLabels[kind].request}</option>
          </select>
        </label>
        <AreaField picker={picker} field="pickup" label={kind === "carshare" ? "Car pickup area" : "Local pickup area"}
          placeholder="Choose an area" required />
        {kind === "carpool" && (
          <>
            <AreaField picker={picker} field="dropoff" label="Work area" placeholder="Choose a work area" required />
            <label>Leave around<input name="start" type="time" defaultValue={listing?.start} required /></label>
            <label>Return around<input name="end" type="time" defaultValue={listing?.end} required /></label>
          </>
        )}
        {kind === "oneoff" && (
          <>
            <AreaField picker={picker} field="dropoff" label="Local drop-off area" placeholder="Choose a drop-off area" required />
            <label>Trip date<input name="date" type="date" defaultValue={listing?.date ?? seed?.date} required /></label>
            <label>Local departure time<input name="start" type="time" defaultValue={listing?.start} required /></label>
          </>
        )}
      </div>
      <AreaPickerMap picker={picker} />
      {outside && !picker.visible && <p className="board-match-help" role="status">Choose a listed meeting area before publishing.</p>}
      <label className="board-consent"><input type="checkbox" name="nearCityBus" defaultChecked={listing?.nearCityBus} />
        <span>I can meet near a CityBus stop.</span>
      </label>
      <MeetingStops area={area} destination={kind === "carshare" ? "" : destination} />
      {kind !== "oneoff" && <fieldset className="board-days">
        <legend>{kind === "carpool" ? "Commute days" : "Usual days (optional)"}</legend>
        {DAYS.map(day => (
          <label key={day}>
            <input type="checkbox" checked={days.includes(day)} onChange={event => {
              setDays(event.target.checked ? [...days, day] : days.filter(value => value !== day));
              setValidation("");
            }} />
            {day}
          </label>
        ))}
      </fieldset>}
      <label>Title
        <input name="title" type="text" required minLength={5} maxLength={70} defaultValue={listing?.title} placeholder={kind === "carpool" ? "Morning commute to Purdue" : kind === "oneoff" ? "Saturday morning ride downtown" : "Occasional car access on weekends"} />
      </label>
      <label>Other details (optional)
        <textarea name="note" maxLength={400} rows={4} defaultValue={listing?.note} placeholder={kind === "carshare" ? "When you usually need or can offer car access" : "Any flexibility or general meetup details"} />
      </label>
      {purdueEligible && (
        <label className="board-consent">
          <input type="checkbox" name="purdue" defaultChecked={listing?.purdue} />
          <span>Show Purdue email badge on this post. The badge reflects your sign-in email domain.</span>
        </label>
      )}
      <TermsConsent />
      <p id="posting-limits" className="board-match-help">{POSTING_LIMITS} Edits don’t count as new posts.</p>
      {(validation || error) && <p className="board-notice is-error" role="alert">{validation || error}</p>}
      <div className="board-card-actions">
        <button type="submit" className="board-button is-primary" aria-describedby="posting-limits" disabled={busy || outside}>{busy ? "Saving…" : listing ? "Save changes" : "Publish post"}</button>
        <a className="board-button is-quiet" href={listing ? "#connections" : "#board"}>Cancel</a>
      </div>
    </form>
  );
}

const dialogCopy = {
  request: { title: "Request an introduction", action: "Send introduction request" },
  accept: { title: "Accept introduction", action: "Accept and share email" },
  report: { title: "Report this post", action: "Submit report" },
  remove: { title: "Remove this post?", action: "Remove post" },
};

function TermsConsent() {
  return (
    <label className="board-consent">
      <input type="checkbox" name="terms-consent" required />
      <span>I agree to the <a href="/terms" target="_blank" rel="noopener">Terms of Use</a> and acknowledge the <a href="/privacy" target="_blank" rel="noopener">Privacy Notice</a>.</span>
    </label>
  );
}

function ActionDialog({ action, busy, error, onClose, onSubmit }: {
  action: DialogState;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<boolean>;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const modal = ref.current;
    modal?.showModal();
    return () => modal?.close();
  }, []);

  const copy = dialogCopy[action.type];
  return (
    <dialog ref={ref} className="board-dialog" aria-labelledby="board-dialog-title" onCancel={event => {
      event.preventDefault();
      if (!busy) onClose();
    }}>
      <form className="board-form" onSubmit={event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void onSubmit(String(form.get("value") ?? "").trim());
      }}>
        <h3 id="board-dialog-title">{copy.title}</h3>
        {action.type === "request" && <>
          <p>Your sign-in email becomes visible to this neighbor only if they accept. You can then work out details privately.</p>
          <label>Intro note (optional)<textarea name="value" maxLength={240} rows={3} aria-describedby="intro-note-help" placeholder="Say hello and share what makes this a good fit." /></label>
          <p id="intro-note-help">Keep contact information and exact addresses out of the note.</p>
        </>}
        {action.type === "accept" && (
          <p>{action.intro.name} will see your sign-in email, and you’ll see theirs. You can then continue privately.</p>
        )}
        {action.type === "report" && (
          <label>Why are you reporting this post?<textarea name="value" minLength={5} maxLength={240} rows={3} required /></label>
        )}
        {action.type === "remove" && <p>This removes the listing from the public board.</p>}
        {(action.type === "request" || action.type === "accept") && <TermsConsent />}
        {error && <p className="board-notice is-error" role="alert">{error}</p>}
        <div className="board-card-actions">
          <button type="submit" className="board-button is-primary" disabled={busy}>{busy ? "Working…" : copy.action}</button>
          <button type="button" className="board-button is-quiet" onClick={onClose} disabled={busy}>Cancel</button>
        </div>
      </form>
    </dialog>
  );
}
