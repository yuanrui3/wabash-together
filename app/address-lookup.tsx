"use client";

import { useEffect, useRef, useState } from "react";
import { findAddress, type AddressIndex } from "../lib/address-lookup";

// Only the shared address index is downloaded and cached.
let data: Promise<AddressIndex> | undefined;
function loadIndex() {
  if (!data) {
    data = fetch("/area-lookup.json").then(async response => {
      if (!response.ok) throw new Error("Address index unavailable");
      const index: AddressIndex = await response.json();
      if (!Array.isArray(index.areas) || typeof index.streets !== "object" || !index.streets) {
        throw new Error("Invalid address index");
      }
      return index;
    }).catch(error => {
      data = undefined;
      throw error;
    });
  }
  return data;
}

export function AddressLookup({ id, label, onArea }: {
  id: string;
  label: string;
  onArea: (area: string) => void;
}) {
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    return () => { request.current += 1; };
  }, []);

  async function lookup() {
    const current = ++request.current;
    if (!address.trim()) {
      setMessage("Enter a street number and street name.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const index = await loadIndex();
      if (request.current !== current) return;
      const result = findAddress(address, index);
      if (result.kind === "found") {
        input.current?.setCustomValidity("");
        setAddress("");
        setMessage(`Selected ${result.area}.`);
        onArea(result.area);
      } else if (result.kind === "ambiguous") {
        setMessage("More than one neighborhood matches. Add the city or ZIP code, or choose an area on the map.");
      } else if (result.kind === "incomplete") {
        setMessage("Enter a street number and street name. You can also include the city and ZIP code.");
      } else {
        setMessage("No local match. Check the spelling and street number, or choose a meeting area on the map.");
      }
    } catch {
      if (request.current === current) setMessage("Address lookup is unavailable. Try again or choose an area on the map.");
    } finally {
      if (request.current === current) setBusy(false);
    }
  }

  return (
    <div className="board-address-lookup">
      <label htmlFor={id}>Street address for {label}</label>
      <p id={id + "-hint"}>No apartment number needed. Only the neighborhood is shared.</p>
      <div className="board-address-row">
        <input ref={input} id={id} type="text" value={address} placeholder="Street number and street name"
          autoComplete="off" spellCheck={false} maxLength={220} enterKeyHint="search"
          aria-describedby={id + "-hint"} onChange={event => {
            request.current += 1;
            event.currentTarget.setCustomValidity(event.currentTarget.value.trim()
              ? "Find the area for this address, or clear the address before posting." : "");
            setBusy(false);
            setMessage("");
            setAddress(event.target.value);
          }}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.stopPropagation();
              if (!busy) void lookup();
            }
          }} />
        <button type="button" className="board-button is-quiet" disabled={busy} onClick={() => void lookup()}>
          {busy ? "Finding…" : "Find area"}
        </button>
      </div>
      <p role="status" aria-live="polite">{message}</p>
    </div>
  );
}
