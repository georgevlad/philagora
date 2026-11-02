import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AgoraShell } from "@/components/agora/AgoraShell";
import { FocusArticle } from "@/components/in-focus/FocusArticle";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublishedFocusEdition, getPublishedFocusEditions } from "@/lib/in-focus-published";
import { focusEditionPath } from "@/lib/in-focus-publication";
import { buildArticleSchema, buildBreadcrumbSchema } from "@/lib/seo/schema";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getPublishedFocusEditions().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const edition = getPublishedFocusEdition((await params).slug);
  if (!edition) return { title: "Issue not found", robots: { index: false } };
  return {
    title: edition.title,
    description: edition.description,
    alternates: { canonical: focusEditionPath(edition) },
    openGraph: { type: "article", title: edition.title, description: edition.description, url: focusEditionPath(edition), publishedTime: edition.publishedAt },
    twitter: { card: "summary", title: edition.title, description: edition.description },
  };
}

export default async function FocusPage({ params }: Props) {
  const edition = getPublishedFocusEdition((await params).slug);
  if (!edition) notFound();
  const path = focusEditionPath(edition);
  return <AgoraShell>
    <JsonLd data={[
      buildArticleSchema({ url: path, headline: edition.title, description: edition.description, datePublished: edition.publishedAt, dateModified: edition.publishedAt }),
      buildBreadcrumbSchema([{ name: "Philagora", url: "/" }, { name: edition.title, url: path }]),
    ]} />
    <main id="main" className="in-focus-page">
      <Link href="/#world" className="in-focus-back">← The questions we share</Link>
      <FocusArticle edition={edition} />
    </main>
  </AgoraShell>;
}
