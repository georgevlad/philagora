import { getSiteUrl, toAbsoluteUrl } from "@/lib/seo";

type SchemaOrgThing = Record<string, unknown>;

interface ArticleSchemaInput {
  url: string;
  headline: string;
  description: string;
  datePublished: Date | string;
  dateModified: Date | string;
  imageUrl?: string;
}

interface QAPageAnswerInput {
  text: string;
}

interface QAPageSchemaInput {
  url: string;
  question: string;
  askedDate: Date | string;
  answers: QAPageAnswerInput[];
}

interface BreadcrumbItemInput {
  name: string;
  url: string;
}

const SCHEMA_CONTEXT = "https://schema.org";
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

function toIsoOrUndefined(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function getOrganizationId() {
  return `${getSiteUrl()}/#organization`;
}

function toSchemaUrl(url: string) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return toAbsoluteUrl(url);
}

function buildOrganizationReference() {
  return {
    "@id": getOrganizationId(),
  };
}

function buildAnswerSchema(answer: QAPageAnswerInput): SchemaOrgThing {
  return {
    "@type": "Answer",
    text: answer.text,
    author: buildOrganizationReference(),
  };
}

export function buildOrganizationSchema(): SchemaOrgThing {
  const siteUrl = getSiteUrl();

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Organization",
    "@id": getOrganizationId(),
    name: "Philagora",
    url: siteUrl,
    logo: toAbsoluteUrl("/icon-512.png"),
    sameAs: [],
  };
}

export function buildWebSiteSchema(): SchemaOrgThing {
  const siteUrl = getSiteUrl();

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    publisher: buildOrganizationReference(),
  };
}

export function buildArticleSchema({
  url,
  headline,
  description,
  datePublished,
  dateModified,
  imageUrl,
}: ArticleSchemaInput): SchemaOrgThing {
  const absoluteUrl = toSchemaUrl(url);

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Article",
    "@id": `${absoluteUrl}#article`,
    url: absoluteUrl,
    mainEntityOfPage: absoluteUrl,
    headline,
    description,
    datePublished: toIsoOrUndefined(datePublished),
    dateModified: toIsoOrUndefined(dateModified),
    image: imageUrl
      ? {
          "@type": "ImageObject",
          url: toSchemaUrl(imageUrl),
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
        }
      : undefined,
    author: buildOrganizationReference(),
    publisher: buildOrganizationReference(),
  };
}

export function buildQAPageSchema({
  url,
  question,
  askedDate,
  answers,
}: QAPageSchemaInput): SchemaOrgThing {
  const absoluteUrl = toSchemaUrl(url);
  const acceptedAnswer = answers[0] ? buildAnswerSchema(answers[0]) : undefined;
  const suggestedAnswer = answers.slice(1).map(buildAnswerSchema);

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "QAPage",
    "@id": `${absoluteUrl}#qa-page`,
    url: absoluteUrl,
    mainEntity: {
      "@type": "Question",
      name: question,
      text: question,
      dateCreated: toIsoOrUndefined(askedDate),
      acceptedAnswer,
      suggestedAnswer: suggestedAnswer.length > 0 ? suggestedAnswer : undefined,
    },
    author: buildOrganizationReference(),
    publisher: buildOrganizationReference(),
  };
}

export function buildBreadcrumbSchema(
  items: BreadcrumbItemInput[]
): SchemaOrgThing {
  const absoluteItems = items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: toSchemaUrl(item.url),
  }));
  const lastItem = items[items.length - 1];

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    "@id": lastItem ? `${toSchemaUrl(lastItem.url)}#breadcrumb` : undefined,
    itemListElement: absoluteItems,
  };
}
