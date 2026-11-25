"use client";

import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { AREAS } from "@/lib/community";
import "./neighborhood-map.css";

type Area = (typeof AREAS)[number];

// Percent positions use the WGS84 bounds declared in public/wabash-map.svg.
const places: Record<Area, { label: string; x: number; y: number; side?: "left" | "top" | "bottom" }> = {
  "Purdue campus": { label: "Purdue campus", x: 44.9, y: 64.8, side: "left" },
  "Chauncey / New Chauncey": { label: "Chauncey", x: 56.1, y: 56.8 },
  "Wabash Landing / Levee": { label: "Wabash Landing", x: 62.6, y: 68.8, side: "left" },
  "University Farm / Happy Hollow": { label: "Happy Hollow", x: 61.7, y: 47.2 },
  "Faith West / Northwestern & Lindberg": { label: "Faith West", x: 39.1, y: 37.2, side: "top" },
  "University Crossing / Soldiers Home Road": { label: "University Crossing", x: 60.3, y: 28.2 },
  "Soldiers Home Road / Kalberer Road": { label: "Soldiers Home & Kalberer", x: 64.2, y: 11.8 },
  "North West Lafayette": { label: "North West Lafayette", x: 43.7, y: 16.6 },
  "Purdue Research Park": { label: "Research Park", x: 32.9, y: 15.5, side: "top" },
  "Blackbird Farms / Lindberg": { label: "Blackbird Farms / Lindberg", x: 23.3, y: 38.7, side: "bottom" },
  "Cason Park / West Cumberland": { label: "Cason Park / West Cumberland", x: 13.2, y: 22.5 },
  "West State Street / Discovery Park": { label: "Discovery Park", x: 32.7, y: 76.8, side: "left" },
  "Downtown Lafayette": { label: "Downtown Lafayette", x: 75.7, y: 72.8 },
  "Centennial / North Riverfront": { label: "Centennial", x: 76.6, y: 59.2 },
  "Wabash Avenue / South Riverfront": { label: "South Riverfront", x: 67.3, y: 88.8, side: "bottom" },
};

const zoomLevels = [1, 1.3, 1.65] as const;
const bound = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// The SVG spans about 7.7 km east to west and 8.9 km north to south.
// Offer a nearby named area only within about half a mile of its reference point.
function nearbyArea(xPercent: number, yPercent: number): Area | null {
  let nearest: Area | null = null;
  let distanceLimit = 805;
  for (const name of AREAS) {
    const location = places[name];
    const meters = Math.hypot((xPercent - location.x) * 77, (yPercent - location.y) * 89);
    if (meters <= distanceLimit) {
      distanceLimit = meters;
      nearest = name;
    }
  }
  return nearest;
}

interface Props {
  id: string;
  area: string;
  onAreaChange: (area: string) => void;
  counts?: Record<string, number>;
  picking: string;
  comparingRoute?: boolean;
  onSkip?: () => void;
  unlisted?: boolean;
  controls?: ReactNode;
}

export function NeighborhoodMap({ id, area, onAreaChange, counts, picking, comparingRoute, onSkip, unlisted, controls }: Props) {
  const [step, setStep] = useState(0);
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [suggestion, setSuggestion] = useState<Area | "far" | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; fromX: number; fromY: number; moved: boolean; fromMarker: boolean } | null>(null);
  const suppressClick = useRef(false);
  const world = useRef<HTMLDivElement>(null);
  const scale = zoomLevels[step];
  const selected = AREAS.find((name) => name === area);
  const countFor = (name: string) => counts?.[name] ?? 0;
  const showCounts = counts !== undefined;
  useEffect(() => { setSuggestion(null); }, [area, picking]);

  function zoom(next: number) {
    setSuggestion(null);
    setStep(next);
    const factor = zoomLevels[next];
    const limit = (factor - 1) / 2;
    const point = selected && places[selected];
    setShift(point ? { x: bound((.5 - point.x / 100) * factor, -limit, limit), y: bound((.5 - point.y / 100) * factor, -limit, limit) } : { x: 0, y: 0 });
  }

  function select(value: string) {
    setSuggestion(null);
    onAreaChange(value);
  }

  function closeSuggestion() {
    setSuggestion(null);
    document.getElementById(id)?.focus({ preventScroll: true });
  }

  function startGesture(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    const fromMarker = Boolean((event.target as Element).closest("button"));
    suppressClick.current = false;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, fromX: shift.x, fromY: shift.y, moved: false, fromMarker };
    if (!fromMarker) event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveGesture(event: PointerEvent<HTMLDivElement>) {
    const origin = drag.current;
    if (!origin || origin.id !== event.pointerId) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (!origin.moved && Math.hypot(dx, dy) < 6) return;
    origin.moved = true;
    suppressClick.current = true;
    if (step === 0) return;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
    setSuggestion(null);
    const limit = (scale - 1) / 2;
    setShift({
      x: bound(origin.fromX + dx / event.currentTarget.clientWidth, -limit, limit),
      y: bound(origin.fromY + dy / event.currentTarget.clientHeight, -limit, limit),
    });
  }

  function finishGesture(event: PointerEvent<HTMLDivElement>) {
    const origin = drag.current;
    if (!origin || origin.id !== event.pointerId) return;
    drag.current = null;
    setPanning(false);
    if (event.type !== "pointerup" || origin.fromMarker || origin.moved || !world.current) return;
    const viewport = event.currentTarget.getBoundingClientRect();
    if (event.clientX < viewport.left || event.clientX > viewport.right ||
        event.clientY < viewport.top || event.clientY > viewport.bottom) return;
    const rect = world.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 100;
    const y = (event.clientY - rect.top) / rect.height * 100;
    setSuggestion(nearbyArea(x, y) ?? "far");
  }

  return (
    <section id={id} tabIndex={-1} className="neighborhood-map" aria-label={`Choose a local ${picking}`}>
      <div className="neighborhood-map__header">
        <div>
          <h3>Explore by neighborhood</h3>
          <p>Tap a marker to set your {picking}, or tap nearby for a suggestion.</p>
          {unlisted && <p>Choose a listed place you can reach in West Lafayette or along the Lafayette riverfront.</p>}
        </div>
        {onSkip ? <button type="button" onClick={onSkip}>Skip this area</button>
          : selected && <button type="button" onClick={() => select("")}>Clear area</button>}
      </div>
      {controls && <div className="neighborhood-map__controls">{controls}</div>}
      <div className="neighborhood-map__frame">
        <div
          className="neighborhood-map__viewport"
          data-pannable={step > 0}
          data-panning={panning}
          onPointerDown={startGesture}
          onPointerMove={moveGesture}
          onPointerUp={finishGesture}
          onPointerCancel={finishGesture}
          onLostPointerCapture={event => {
            if (event.target === event.currentTarget) finishGesture(event);
          }}
          onClickCapture={event => {
            if (suppressClick.current && event.detail > 0) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          <div ref={world} className="neighborhood-map__world" style={{ transform: `translate(${shift.x * 100}%, ${shift.y * 100}%) scale(${scale})` }}>
            <div className="neighborhood-map__city neighborhood-map__city--west" aria-hidden="true">West Lafayette</div>
            <div className="neighborhood-map__city neighborhood-map__city--east" aria-hidden="true">Lafayette</div>
            <div className="neighborhood-map__river" aria-hidden="true">Wabash River</div>
            {AREAS.map((name) => {
              const location = places[name];
              const count = countFor(name);
              const position = { left: `${location.x}%`, top: `${location.y}%`, transform: `translate(-50%, -50%) scale(${1 / scale})` };
              return (
                <div key={name} className="neighborhood-map__spot">
                  <button
                    type="button"
                    className="neighborhood-map__marker"
                    data-has-posts={showCounts && count > 0}
                    aria-label={`Choose ${name} as ${picking}${showCounts ? `, ${count} ${count === 1 ? "post" : "posts"}` : ""}`}
                    aria-pressed={selected === name}
                    onClick={() => select(name)}
                    style={position}
                  >
                    <span className="neighborhood-map__count" aria-hidden="true">{showCounts ? count : "•"}</span>
                  </button>
                  <span className="neighborhood-map__label-anchor" data-side={location.side ?? "right"} style={position}>
                    <button type="button" className="neighborhood-map__name" aria-hidden="true" tabIndex={-1} onClick={() => select(name)}>
                      {location.label}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {suggestion && (
          <div className="neighborhood-map__suggestion">
            <p role="status">{suggestion === "far" ? "No listed marker is close to this point. Choose a marker where you can meet." : `Nearby ${picking} · ${suggestion}`}</p>
            {suggestion !== "far" && <button type="button" className="neighborhood-map__apply" onClick={() => {
              closeSuggestion();
              select(suggestion);
            }}>Use {suggestion}</button>}
            <button className="neighborhood-map__dismiss" type="button" aria-label="Dismiss map suggestion" onClick={closeSuggestion}>×</button>
          </div>
        )}
        <div className="neighborhood-map__compass" aria-hidden="true"><span>▲</span> N</div>
        <div className="neighborhood-map__zoom" aria-label="Map zoom controls">
          <button type="button" aria-label="Zoom in" disabled={step === zoomLevels.length - 1} onClick={() => zoom(step + 1)}>+</button>
          <button type="button" aria-label="Zoom out" disabled={step === 0} onClick={() => zoom(step - 1)}>−</button>
        </div>
      </div>
      <div className="neighborhood-map__footer">
        <p aria-live="polite">{selected ? `Selected ${picking} · ${selected}` : showCounts ? "Showing all neighborhoods" : `Choose a ${picking}`}</p>
        {showCounts && <p className="neighborhood-map__legend">{comparingRoute ? "Numbers show matching posts by pickup area." : "Numbers show posts by pickup area."}</p>}
        <details>
          <summary>Neighborhood list</summary>
          <ul>
            {AREAS.map((name) => (
              <li key={name}>
                <button type="button" onClick={() => select(name)} aria-pressed={selected === name}>
                  <span>{name}</span>{showCounts && <strong aria-label={`${countFor(name)} posts`}>{countFor(name)}</strong>}
                </button>
              </li>
            ))}
          </ul>
        </details>
        <small className="neighborhood-map__credit">
          Map data <a href="https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html" target="_blank" rel="noreferrer">U.S. Census Bureau</a> and <a href="https://www.usgs.gov/national-hydrography/national-hydrography-dataset" target="_blank" rel="noreferrer">USGS</a>
        </small>
      </div>
    </section>
  );
}
