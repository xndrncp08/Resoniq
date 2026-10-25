import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const discover = vi.hoisted(() => vi.fn());
vi.mock("@/lib/discovery", () => ({ discoverMusicians: discover }));
import MusiciansPage, { generateMetadata } from "@/app/(app)/musicians/page";
import MusicianRow from "@/components/social/MusicianRow";

beforeEach(() => { discover.mockReset(); discover.mockResolvedValue({ items: [], nextCursor: null }); });

it("renders an actionable empty state and handles repeated query parameters", async () => {
  const html = renderToStaticMarkup(await MusiciansPage({ searchParams: Promise.resolve({ q: ["one", "two"] }) }));
  expect(html).toContain("There’s room for your sound");
  expect(html).toContain('href="/settings"');
  expect(discover).toHaveBeenCalledWith({ q: "", instrument: undefined, genre: "", after: "" });
});

it("renders profile interests, safe text, and pagination with filters intact", async () => {
  discover.mockResolvedValue({ items: [{ id: "one", handle: "mia_01", name: "Mia", image: null, bio: "<script>music</script>", instruments: ["woodwinds"], genres: ["jazz"] }], nextCursor: "mia_01" });
  const html = renderToStaticMarkup(await MusiciansPage({ searchParams: Promise.resolve({ instrument: "woodwinds", genre: "jazz" }) }));
  expect(html).toContain('href="/u/mia_01"');
  expect(html).toContain('href="/musicians?instrument=woodwinds&amp;genre=jazz&amp;after=mia_01"');
  expect(html).toContain("&lt;script&gt;music&lt;/script&gt;");
  expect(html).toContain('href="/tag/collaboration?sort=new"');
});

it("indexes the directory but keeps search and pagination variants out of search engines", async () => {
  expect((await generateMetadata({ searchParams: Promise.resolve({}) })).robots).toBeUndefined();
  expect((await generateMetadata({ searchParams: Promise.resolve({ genre: "jazz" }) })).robots).toEqual({ index: false, follow: true });
});

it("labels managed creators in existing search and featured musician rows", () => {
  const user = { handle: "resoniq_clara", name: "Clara", image: null };
  expect(renderToStaticMarkup(MusicianRow({ u: { ...user, managedCreator: { id: "demo" } } }))).toContain("Resoniq-managed");
  expect(renderToStaticMarkup(MusicianRow({ u: user }))).not.toContain("Resoniq-managed");
});
