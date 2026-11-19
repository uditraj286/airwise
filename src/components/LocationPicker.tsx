"use client";

import { Clock, Crosshair, Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { POPULAR_CITIES, rememberPlace, usePlaces, type Place } from "@/lib/places";
import type { Profile } from "@/lib/profile/schema";

/** Bold the part of a place name that matches what was typed. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-semibold text-ink">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/**
 * Location search as an accessible combobox: type a city (results as you type, arrow keys + Enter), pick a recent
 * place or a popular city with one tap, or use the device's precise location.
 */
export function LocationPicker({
  value,
  onChange,
}: {
  value?: Profile["location"];
  onChange: (p: Place) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState("");
  const recent = usePlaces();
  const id = useId();
  const listId = `${id}-list`;
  const selection = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      selection.current += 1;
    },
    [],
  );

  const typed = query.trim().length >= 2;

  useEffect(() => {
    if (!typed) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`, { signal: ctrl.signal })
        .then((r) => {
          if (!r.ok) throw new Error("City search is unavailable.");
          return r.json();
        })
        .then((data: Place[]) => {
          if (ctrl.signal.aborted) return;
          setResults(data);
          setActive(data.length ? 0 : -1);
          setStatus(
            data.length
              ? `${data.length} places found. Use the arrow keys to choose.`
              : `No places match “${query.trim()}”. Check the spelling or try a nearby city.`,
          );
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setStatus("City search is unavailable. Try again or use your location.");
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setSearching(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, typed]);

  const choose = (p: Place): void => {
    selection.current += 1;
    const place = { name: p.name.slice(0, 80), lat: Number(p.lat.toFixed(4)), lon: Number(p.lon.toFixed(4)) };
    onChange(place);
    rememberPlace(place);
    setQuery("");
    setResults([]);
    setOpen(false);
    setActive(-1);
    setStatus(`Location set to ${place.name}.`);
  };

  const useMyLocation = (): void => {
    if (!navigator.geolocation) return setStatus("Location is not available in this browser.");
    setStatus("Finding you…");
    const request = ++selection.current;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));
        let name = "My location";
        try {
          const response = await fetch(`/api/geocode?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`, {
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
          });
          if (response.ok) {
            const place = (await response.json()) as { name: string | null };
            name = place.name || name;
          }
        } catch {
          // Coordinates are sufficient for the air provider.
        }
        if (selection.current !== request) return;
        const place = { name: name.slice(0, 80), lat, lon };
        onChange(place);
        rememberPlace(place);
        setStatus(`Location set to ${name}.`);
      },
      () => {
        if (selection.current === request)
          setStatus("Could not get your location. Allow location access, or type your city instead.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  };

  // What the dropdown shows: search results while typing, otherwise recent places then popular cities.
  const suggestions: { place: Place; kind: "result" | "recent" | "popular" }[] = typed
    ? results.map((place) => ({ place, kind: "result" as const }))
    : [
        ...recent.slice(0, 4).map((place) => ({ place, kind: "recent" as const })),
        ...POPULAR_CITIES.filter((c) => !recent.some((r) => r.name === c.name))
          .slice(0, 6)
          .map((place) => ({ place, kind: "popular" as const })),
      ];
  const showList = open && suggestions.length > 0;

  const onKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(suggestions.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      const pick = suggestions[active >= 0 ? active : 0];
      if (showList && pick) {
        e.preventDefault();
        choose(pick.place);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div>
      {value && (
        <p className="flex items-center gap-2 text-[15px]">
          <MapPin className="h-4 w-4 text-brand" aria-hidden="true" />
          <span>
            Current location: <strong className="font-semibold">{value.name}</strong>
          </span>
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor={id} className="sr-only">
            Search for your city or area
          </label>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id={id}
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(-1);
              if (e.target.value.trim().length < 2) setResults([]);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKey}
            placeholder="Type your city or area, e.g. Lucknow"
            className="w-full rounded-xl border border-line bg-surface py-3 pl-10 pr-10 text-[15px] focus:border-brand focus:outline-none"
          />
          {searching ? (
            <Loader2
              className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted"
              aria-hidden="true"
            />
          ) : (
            query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  inputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-subtle"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )
          )}
          {showList && (
            <ul
              id={listId}
              role="listbox"
              aria-label={typed ? "Matching places" : "Suggested places"}
              className="card animate-in absolute inset-x-0 top-full z-30 mt-2 max-h-80 overflow-y-auto p-1.5"
            >
              {!typed && recent.length > 0 && (
                <li
                  role="presentation"
                  className="px-3 pb-1 pt-2 text-caption font-medium uppercase tracking-wider text-muted"
                >
                  Recent
                </li>
              )}
              {suggestions.map(({ place, kind }, i) => (
                <li key={`${kind}-${place.lat},${place.lon}`} role="presentation">
                  {!typed && kind === "popular" && (i === 0 || suggestions[i - 1]?.kind !== "popular") && (
                    <p className="px-3 pb-1 pt-2 text-caption font-medium uppercase tracking-wider text-muted">
                      Popular cities
                    </p>
                  )}
                  <div
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(place)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] ${i === active ? "bg-brand/10" : ""}`}
                  >
                    {kind === "recent" ? (
                      <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    ) : (
                      <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    )}
                    <span className="min-w-0 truncate">
                      <Highlight text={place.name} query={query} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-[15px] font-medium hover:border-brand hover:text-brand"
        >
          <Crosshair className="h-4 w-4" aria-hidden="true" />
          Use precise location
        </button>
      </div>
      <p className="mt-2 text-caption text-muted">
        Tip: start typing and pick from the list, or tap “Use precise location”. Your precise location stays
        on this device; account sync saves an approximate one.
      </p>
      <p className="mt-1 text-caption text-muted" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
