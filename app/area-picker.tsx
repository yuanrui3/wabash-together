"use client";

import { useState } from "react";
import { AREAS, OUTSIDE_AREA, type Kind } from "../lib/community";
import { AddressLookup } from "./address-lookup";
import { NeighborhoodMap } from "./neighborhood-map";

type Endpoint = "pickup" | "dropoff";

export function useAreaPicker(
  context: "browse" | "post", kind: Kind, area: string, destination: string,
  setArea: (value: string) => void, setDestination: (value: string) => void,
) {
  const [endpoint, setEndpoint] = useState<Endpoint>("pickup");
  const [addressFor, setAddressFor] = useState<Endpoint | null>(null);
  const [expanded, setExpanded] = useState(false);
  const target = kind === "carshare" ? "pickup" : endpoint;
  const mapId = context + "-map";

  function activate(field: Endpoint) {
    setAddressFor(null);
    setEndpoint(field);
  }

  function show(field: Endpoint) {
    activate(field);
    setExpanded(true);
    requestAnimationFrame(() => {
      const map = document.getElementById(mapId);
      map?.focus({ preventScroll: true });
      map?.scrollIntoView({ block: "start" });
    });
  }

  function setAreaValue(field: Endpoint, value: string) {
    if (field === "pickup") setArea(value);
    else setDestination(value);
    setEndpoint(field);
  }

  function change(field: Endpoint, value: string) {
    setAddressFor(null);
    setAreaValue(field, value);
    if (value === OUTSIDE_AREA) show(field);
  }

  function toggleAddress(field: Endpoint) {
    setEndpoint(field);
    setAddressFor(current => current === field ? null : field);
  }

  function close() {
    setExpanded(false);
    document.getElementById(context + "-" + target + "-map-button")?.focus();
  }

  function reset() {
    setExpanded(false);
    activate("pickup");
  }

  return {
    context, kind, area, destination, target, mapId, show, change, close, reset, activate, addressFor, toggleAddress, setAreaValue,
    visible: context === "browse" || expanded,
    targetLabel: target === "pickup" ? "pickup area" : kind === "carpool" ? "work area" : "drop-off area",
    selected: target === "pickup" ? area : destination,
  };
}

type Picker = ReturnType<typeof useAreaPicker>;

export function AreaField({ picker, field, label, placeholder, required }: {
  picker: Picker;
  field: Endpoint;
  label: string;
  placeholder: string;
  required?: boolean;
}) {
  const id = picker.context + "-" + field;
  const shortLabel = field === "pickup" ? "pickup area" : picker.kind === "carpool" ? "work area" : "drop-off area";
  const value = field === "pickup" ? picker.area : picker.destination;
  return (
    <div className="board-area-field">
      <div className="board-area-label">
        <label htmlFor={id}>{label}</label>
      </div>
      <select id={id} value={value} onChange={event => picker.change(field, event.target.value)} required={required}>
        <option value="">{placeholder}</option>
        {AREAS.map(option => <option key={option}>{option}</option>)}
        <option value={OUTSIDE_AREA}>My area isn’t listed</option>
      </select>
      <div className="board-area-methods">
        <button id={id + "-map-button"} type="button" className="board-map-link"
          aria-label={`Choose ${shortLabel} on map`}
          aria-controls={picker.visible ? picker.mapId : undefined}
          onClick={() => picker.show(field)}>Choose on map</button>
        <button type="button" className="board-map-link"
          aria-label={`Enter an address for ${shortLabel}`}
          aria-expanded={picker.addressFor === field}
          aria-controls={picker.addressFor === field ? id + "-lookup" : undefined}
          onClick={() => picker.toggleAddress(field)}>Enter address</button>
      </div>
      {picker.addressFor === field &&
        <div id={id + "-lookup"}>
          <AddressLookup key={id} id={id + "-street"} label={shortLabel} onArea={value => picker.setAreaValue(field, value)} />
        </div>}
    </div>
  );
}

export function AreaPickerMap({ picker, counts, comparingRoute }: {
  picker: Picker;
  counts?: Record<string, number>;
  comparingRoute?: boolean;
}) {
  if (!picker.visible) return null;
  const unlisted = picker.selected === OUTSIDE_AREA;
  const browse = picker.context === "browse";
  const controls = (
    <div className="board-map-actions">
      {picker.kind !== "carshare" &&
        <div className="board-map-targets" role="group" aria-label="Choose which area to set">
          <button type="button" aria-pressed={picker.target === "pickup"} onClick={() => picker.activate("pickup")}>Pickup</button>
          <button type="button" aria-pressed={picker.target === "dropoff"} onClick={() => picker.activate("dropoff")}>{picker.kind === "carpool" ? "Work" : "Drop-off"}</button>
        </div>}
      {!browse && <button type="button" className="board-map-done" onClick={picker.close}>Done</button>}
    </div>
  );
  return (
    <NeighborhoodMap id={picker.mapId} area={unlisted ? "" : picker.selected}
      onAreaChange={value => picker.change(picker.target, value)}
      picking={picker.targetLabel}
      unlisted={unlisted}
      comparingRoute={comparingRoute}
      counts={picker.target === "pickup" && !unlisted ? counts : undefined}
      controls={controls}
      onSkip={browse && unlisted ? () => picker.change(picker.target, "") : undefined} />
  );
}
