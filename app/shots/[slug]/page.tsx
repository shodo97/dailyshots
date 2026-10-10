import { notFound } from "next/navigation";
import { ShotChrome } from "@/components/shot/ShotChrome";
import { ShotStage } from "@/components/shot/ShotStage";
import { allShots, findShot, neighbours, routeSlug } from "@/shots";
import { posterSrc } from "@/shots/types";

export function generateStaticParams() {
  return allShots.map((entry) => ({ slug: routeSlug(entry) }));
}

export async function generateMetadata({ params }: PageProps<"/shots/[slug]">) {
  const { slug } = await params;
  const entry = findShot(slug);
  if (!entry) return {};
  const { meta } = entry;
  return {
    title: meta.title,
    description: meta.note,
    openGraph: {
      title: `${meta.n} — ${meta.title}`,
      description: meta.note,
      images: [{ url: posterSrc(meta), width: 1600, height: 1000 }],
    },
    // Drafts stay reachable by URL but should not be indexed or listed.
    robots: meta.published ? undefined : { index: false, follow: false },
  };
}

export default async function ShotPage({ params }: PageProps<"/shots/[slug]">) {
  const { slug } = await params;
  const entry = findShot(slug);
  if (!entry) notFound();

  const { default: Shot } = await entry.load();
  const { prev, next } = neighbours(slug);

  return (
    <>
      <ShotStage meta={entry.meta}>
        <Shot />
      </ShotStage>
      <ShotChrome meta={entry.meta} prev={prev?.meta} next={next?.meta} />
    </>
  );
}
