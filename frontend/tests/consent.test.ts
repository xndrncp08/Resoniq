import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDeviceStorage, deviceStorage, hasConsent, parseConsent, persistMemory, readConsentCookie, serializeConsent, writeConsentCookie } from "@/lib/consent";

// A minimal browser: one cookie jar and one localStorage.
function fakeBrowser() {
  let jar = "";
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
    clear: () => store.clear(),
  };
  // Object.keys(localStorage) lists stored keys in real browsers.
  const proxy = new Proxy(localStorage, { ownKeys: () => [...store.keys()], getOwnPropertyDescriptor: (_t, k) => (store.has(String(k)) ? { enumerable: true, configurable: true, value: store.get(String(k)) } : undefined) });
  vi.stubGlobal("document", { get cookie() { return jar; }, set cookie(v: string) { const [pair] = v.split(";"); const name = pair.split("=")[0]; jar = [...jar.split(/;\s*/).filter((c) => c && !c.startsWith(`${name}=`)), pair].join("; "); } });
  vi.stubGlobal("location", { protocol: "https:" });
  vi.stubGlobal("localStorage", proxy);
  return store;
}

describe("consent record", () => {
  it("round-trips and rejects anything malformed or from another version", () => {
    const c = { preferences: true, analytics: false, at: 1_790_000_000_000 };
    expect(parseConsent(serializeConsent(c))).toEqual(c);
    for (const raw of ["", "yes", "2.p1.a1.1790000000", "1.p2.a0.1", "1.p1.a0.", null, undefined]) expect(parseConsent(raw)).toBeNull();
    expect(readConsentCookie("a=1; resoniq_consent=1.p0.a0.1790000000; b=2")).toEqual({ preferences: false, analytics: false, at: 1_790_000_000_000 });
  });
});

describe("on-device storage follows the choice", () => {
  let store: Map<string, string>;
  beforeEach(() => { store = fakeBrowser(); });
  afterEach(() => vi.unstubAllGlobals());

  it("writes nothing to the browser before a choice, or after rejecting optional storage", () => {
    deviceStorage.setItem("resoniq:preferences", "{}");
    expect(store.size).toBe(0);
    expect(deviceStorage.getItem("resoniq:preferences")).toBe("{}"); // still works for this visit
    writeConsentCookie({ preferences: false, analytics: false, at: Date.now() });
    deviceStorage.setItem("resoniq:drafts", "{}");
    expect(store.size).toBe(0);
    expect(hasConsent("analytics")).toBe(false);
  });

  it("keeps settings once allowed, including what was set earlier in the visit", () => {
    deviceStorage.setItem("resoniq.practice.v1", "note");
    writeConsentCookie({ preferences: true, analytics: false, at: Date.now() });
    persistMemory();
    expect(store.get("resoniq.practice.v1")).toBe("note");
    deviceStorage.setItem("resoniq:preferences", "{\"scene3d\":\"off\"}");
    expect(store.get("resoniq:preferences")).toBe("{\"scene3d\":\"off\"}");
  });

  it("withdrawing deletes only Resoniq's keys", () => {
    store.set("resoniq:drafts", "x");
    store.set("resoniq:tank-g-banks:v2:user", "y");
    store.set("someone-else", "z");
    clearDeviceStorage();
    expect([...store.keys()]).toEqual(["someone-else"]);
  });
});
