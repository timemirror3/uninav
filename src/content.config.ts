import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Content lives in MDX so the owner can edit copy without touching components.
 *
 * The copy was signed off by the owner on 2026-08-02, at which point the
 * [DRAFT COPY — REVIEW] markers and their `needsReview` frontmatter flag were
 * removed. CONTENT-REVIEW.md still tracks the open legal and compliance items,
 * which are not copy questions.
 */

const services = defineCollection({
  loader: glob({ base: './src/content/services', pattern: '**/*.mdx' }),
  schema: z.object({
    /** Must match a ProductSlug in src/lib/products.ts. */
    slug: z.enum([
      'counseling-bundle',
      'essay-review',
      'essay-reviews-5',
      'zoom-followups-5',
      'rush-consultation',
    ]),
    /** Sort order on /services and in the sitemap. */
    order: z.number(),
    name: z.string(),
    /** Opening paragraph on the detail page. */
    lede: z.string(),
    /** Shorter summary used on the /services cards. */
    cardSummary: z.string(),
    /** Bullets on the /services card (bundle and essay only). */
    cardBullets: z.array(z.string()).default([]),
    /** Numbered "What's included" rows on the detail page. */
    includes: z
      .array(
        z.object({
          n: z.string(),
          t: z.string(),
          d: z.string(),
        })
      )
      .default([]),
    /** "How it works" paragraph. Omitted when the prototype left it empty. */
    how: z.string().optional(),
    /** Renders the "supplements an existing engagement" note. */
    addon: z.boolean().default(false),
    /** Small print under the price on the /services add-on cards. */
    cardFootnote: z.string().optional(),
    /**
     * Rush only: hours within which the office commits to emailing to schedule.
     * The RUSH_RESPONSE_HOURS env var overrides this so the number can change
     * without a rebuild; this value is the fallback default.
     */
    responseHours: z.number().optional(),
    seoDescription: z.string(),
  }),
});

const policies = defineCollection({
  loader: glob({ base: './src/content/policies', pattern: '**/*.mdx' }),
  schema: z.object({
    title: z.string(),
    /** Order in the sticky policy nav. */
    order: z.number(),
    seoDescription: z.string(),
    /** Renders the "ON THIS PAGE" list in the sidebar (scope page only). */
    tableOfContents: z.array(z.string()).default([]),
  }),
});

export const collections = { services, policies };
