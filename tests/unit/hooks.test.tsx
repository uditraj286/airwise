import { act, renderHook, waitFor } from "@testing-library/react";
import { DEMO_PROFILE } from "@/lib/profile/schema";
import {
  clearAllLocalData,
  doneStore,
  planStore,
  todayKey,
  useDoneActions,
  useProfile,
} from "@/lib/profile/store";
import { useAir } from "@/lib/useAir";
import { useCachedPlan, usePlan } from "@/lib/usePlan";
import { air, profile } from "../fixtures";

afterEach(() => {
  localStorage.clear();
  clearAllLocalData();
  vi.unstubAllGlobals();
});

describe("useProfile", () => {
  it("starts with the demo household, then saves and resets", () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current.isDemo).toBe(true);
    act(() => result.current.save({ ...DEMO_PROFILE, language: "hi" }));
    expect(result.current.isDemo).toBe(false);
    expect(result.current.profile.language).toBe("hi");
    act(() => result.current.reset());
    expect(result.current.isDemo).toBe(true);
  });

  it("ignores corrupted storage", () => {
    localStorage.setItem("airwise.profile.v1", "{not json");
    const { result } = renderHook(() => useProfile());
    expect(result.current.isDemo).toBe(true);
    localStorage.setItem("airwise.profile.v1", JSON.stringify({ version: 99 }));
    expect(renderHook(() => useProfile()).result.current.isDemo).toBe(true);
  });
});

describe("useDoneActions", () => {
  it("toggles actions for today", () => {
    const { result } = renderHook(() => useDoneActions());
    act(() => result.current.toggle("close_windows_peaks"));
    expect(result.current.done).toEqual(["close_windows_peaks"]);
    act(() => result.current.toggle("close_windows_peaks"));
    expect(result.current.done).toEqual([]);
  });
});

describe("useAir", () => {
  it("hides the previous city's readings immediately when location changes", async () => {
    const original = air();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(original)))
      .mockImplementationOnce(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(({ location }) => useAir(location), {
      initialProps: { location: original.location },
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    rerender({ location: { lat: 25.61, lon: 85.14, name: "Patna" } });
    expect(result.current.status).toBe("loading");
    expect(result.current.data).toBeUndefined();
  });

  it("ignores a late refresh for a previous precise location", async () => {
    const original = air();
    const location = { ...original.location, lat: original.location.lat + 0.0001 };
    let finishOld: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(original)))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finishOld = resolve;
          }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...original, location })));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(({ place }) => useAir(place), {
      initialProps: { place: original.location },
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.retry());
    rerender({ place: location });
    await waitFor(() => expect(result.current.data?.location).toEqual(location));
    await act(async () => finishOld(new Response(JSON.stringify(original))));
    expect(result.current.data?.location).toEqual(location);
  });

  it("loads, and supports retry after an error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "down" }), { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(air())));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useAir(DEMO_PROFILE.location));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("down");
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("tzOffsetMin=");
  });

  it("shows refresh progress, forces a provider check, and retains the last reading on failure", async () => {
    let finish: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(air())))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useAir(DEMO_PROFILE.location));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.retry());
    expect(result.current.refreshing).toBe(true);
    expect(result.current.status).toBe("ready");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("refresh=1");
    await act(async () => finish(new Response(JSON.stringify({ error: "down" }), { status: 502 })));
    expect(result.current.refreshing).toBe(false);
    expect(result.current.refreshError).toBe("down");
    expect(result.current.status).toBe("ready");
  });

  it("distinguishes an unchanged provider response from new readings", async () => {
    const original = air();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => new Response(JSON.stringify(original)))
      .mockImplementationOnce(async () => new Response(JSON.stringify(original)))
      .mockImplementationOnce(
        async () =>
          new Response(
            JSON.stringify({
              ...original,
              updatedAt: new Date(Date.parse(original.updatedAt) + 3600_000).toISOString(),
              current: { ...original.current, pm25: original.current.pm25 + 0.1 },
            }),
          ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useAir(DEMO_PROFILE.location));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.sameReading).toBe(true));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.sameReading).toBe(false));
    expect(result.current.data?.current.pm25).toBe(original.current.pm25 + 0.1);
  });

  it("bypasses the server cache on initial load, reload and browser history restore", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(air())));
    vi.stubGlobal("fetch", fetchMock);

    const first = renderHook(() => useAir(DEMO_PROFILE.location));
    await waitFor(() => expect(first.result.current.status).toBe("ready"));
    first.unmount();

    const reloaded = renderHook(() => useAir(DEMO_PROFILE.location));
    await waitFor(() => expect(reloaded.result.current.status).toBe("ready"));
    await act(async () => {
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [url, options] of fetchMock.mock.calls) {
      expect(String(url)).toContain("refresh=1");
      expect(options).toMatchObject({ cache: "no-store" });
    }
  });

  it("refreshes quietly every minute while the tab is visible", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(air())));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useAir(DEMO_PROFILE.location));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(async () => {
      vi.advanceTimersByTime(59_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBe("ready");
    vi.useRealTimers();
  });
});

describe("usePlan", () => {
  const plan = { items: [{ actionId: "close_windows_peaks" }], headline: "h" };

  it("auto-generates once, caches, and serves the cache", async () => {
    const p = profile();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(plan)));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePlan(p, { auto: true }));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(renderHook(() => useCachedPlan(p)).result.current).toEqual(plan);
  });

  it("fetches again when the household changes while a plan is loading", async () => {
    let release: (r: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>((r) => (release = r)))
      .mockResolvedValue(new Response(JSON.stringify(plan)));
    vi.stubGlobal("fetch", fetchMock);
    const first = profile();
    const second = { ...first, location: { ...first.location, name: "Somewhere else" } };
    const { result, rerender } = renderHook(({ p }) => usePlan(p, { auto: true }), {
      initialProps: { p: first },
    });
    rerender({ p: second }); // e.g. cloud sync replaced the profile mid-request
    await act(async () => release(new Response(JSON.stringify(plan))));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears ticked steps when the user makes a new plan or the household changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => new Response(JSON.stringify(plan))),
    );
    const p = profile();
    planStore.write({ date: todayKey(), fingerprint: JSON.stringify(p), plan: plan as never });
    doneStore.write({ date: todayKey(), ids: ["close_windows_peaks"] });
    const { result, unmount } = renderHook(() => usePlan(p, { auto: true }));
    expect(result.current.status).toBe("ready");
    await act(() => result.current.generate());
    expect(doneStore.read()).toBeNull();
    unmount();

    doneStore.write({ date: todayKey(), ids: ["close_windows_peaks"] });
    const changed = { ...p, location: { ...p.location, name: "Bihta" } };
    renderHook(() => usePlan(changed, { auto: true }));
    await waitFor(() => expect(doneStore.read()).toBeNull());
  });

  it("surfaces errors and can regenerate on demand", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "busy" }), { status: 429 })),
    );
    const { result } = renderHook(() => usePlan(profile()));
    expect(result.current.status).toBe("idle");
    await act(() => result.current.generate());
    expect(result.current.status).toBe("error");
  });

  it("ignores a cached plan from another day", () => {
    planStore.write({ date: "2000-01-01", fingerprint: JSON.stringify(profile()), plan: plan as never });
    expect(renderHook(() => useCachedPlan(profile())).result.current).toBeNull();
  });
});
