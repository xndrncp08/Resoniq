import { prisma } from "@/lib/prisma";
import { optionalActor } from "@/lib/api";
import { listTones } from "@/lib/tones";
import { platformCounts } from "@/lib/discovery";
import { GEAR_KINDS } from "@/lib/gear";
import Nav from "@/components/landing/Nav";
import HeroStage from "@/components/landing/HeroStage";
import Ecosystem from "@/components/landing/Ecosystem";
import Inspect from "@/components/landing/Inspect";
import GearWall from "@/components/landing/GearWall";
import HowItWorks from "@/components/landing/HowItWorks";
import DeferredExample from "@/components/landing/DeferredExample";
import LiveBoard from "@/components/landing/LiveBoard";
import FinalCta from "@/components/landing/FinalCta";
import Footer from "@/components/landing/Footer";

export default async function Home() {
  const viewer = await optionalActor();
  const [counts, communities, gearByKind, gearItems, tones] = await Promise.all([
    platformCounts(),
    prisma.community.findMany({ where: { archivedAt: null }, orderBy: [{ memberCount: "desc" }, { name: "asc" }], take: 6, select: { slug: true, name: true, memberCount: true, kind: true } }),
    prisma.gearItem.groupBy({ by: ["kind"], where: { status: "APPROVED" }, _count: true }),
    prisma.gearItem.findMany({ where: { status: "APPROVED" }, orderBy: { slug: "asc" }, take: 8, select: { slug: true, brand: true, model: true, kind: true } }),
    listTones(viewer?.id ?? null, { sort: "popular", cursor: null, limit: 4 }),
  ]);
  const gearTotal = gearByKind.reduce((s, g) => s + g._count, 0);
  gearByKind.sort((a, b) => GEAR_KINDS.indexOf(a.kind) - GEAR_KINDS.indexOf(b.kind));
  // Real numbers only. Activity counts appear once there's enough of it to mean something.
  const facts =
    counts.posts >= 50
      ? [{ label: "Musicians", value: counts.musicians.toLocaleString() }, { label: "Posts", value: counts.posts.toLocaleString() }, { label: "Public tones", value: counts.tones.toLocaleString() }]
      : [{ label: "Communities", value: String(counts.communities) }, { label: "Gear in catalog", value: String(gearTotal) }, { label: "Cost to join", value: "$0" }];

  return (
    <>
      <Nav />
      <main id="main" className="relative">
        <HeroStage facts={facts} />
        <GearWall items={gearItems} />
        <Ecosystem communities={communities} gearByKind={gearByKind.map((g) => ({ kind: g.kind, count: g._count }))} gearTotal={gearTotal} />
        <Inspect />
        <LiveBoard tones={tones.items} viewerId={viewer?.id ?? null} />
        <HowItWorks />
        <DeferredExample />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
