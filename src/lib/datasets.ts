import "server-only";
import type { CampaignId, CampaignRow } from "./experiment";

// Server-only: the five dataset versions and the researcher answer key.
// Kept out of experiment.ts so they never end up in the browser bundle
// (participants could otherwise read every version + the answer in DevTools).

const row = (
  campaign: CampaignId,
  clicks: number,
  impressions: number,
  ctr: number,
  conversions: number,
  cpa: number,
  convRate: number,
): CampaignRow => ({ campaign, clicks, impressions, ctr, conversions, cpa, convRate });

export const DATASETS: Record<number, CampaignRow[]> = {
  1: [
    row("A", 170, 2000, 8.5, 25, 3.0, 14.71),
    row("B", 250, 2800, 8.9, 10, 4.5, 4.0),
    row("C", 300, 2500, 12.0, 30, 3.2, 10.0),
    row("D", 200, 4000, 5.0, 40, 2.8, 20.0),
    row("E", 420, 5000, 8.4, 75, 1.8, 17.86),
  ],
  2: [
    row("A", 190, 2200, 8.6, 28, 3.1, 14.74),
    row("B", 280, 3100, 9.0, 12, 4.8, 4.29),
    row("C", 260, 2300, 11.3, 35, 2.9, 13.46),
    row("D", 180, 3800, 4.7, 38, 2.6, 21.11),
    row("E", 390, 4600, 8.5, 80, 1.6, 20.51),
  ],
  3: [
    row("A", 150, 1800, 8.3, 22, 3.4, 14.67),
    row("B", 230, 2600, 8.8, 8, 5.1, 3.48),
    row("C", 340, 2700, 12.6, 28, 3.5, 8.24),
    row("D", 220, 4200, 5.2, 45, 2.4, 20.45),
    row("E", 450, 5200, 8.7, 85, 1.7, 18.89),
  ],
  4: [
    row("A", 200, 2400, 8.3, 30, 2.9, 15.0),
    row("B", 270, 3000, 9.0, 11, 4.2, 4.07),
    row("C", 310, 2600, 11.9, 32, 3.3, 10.32),
    row("D", 240, 4500, 5.3, 42, 2.5, 17.5),
    row("E", 400, 4900, 8.2, 78, 1.9, 19.5),
  ],
  5: [
    row("A", 160, 1900, 8.4, 20, 3.2, 12.5),
    row("B", 240, 2700, 8.9, 9, 5.0, 3.75),
    row("C", 290, 2400, 12.1, 27, 3.6, 9.31),
    row("D", 210, 3900, 5.4, 44, 2.3, 20.95),
    row("E", 430, 5100, 8.4, 82, 1.75, 19.07),
  ],
};

/**
 * Researcher-only answer key ("5 Versi — Campaign E Selalu Optimal" +
 * "Distractor Design"). Never sent to the chat model or the browser; only the
 * grader sees it.
 */
export const ANSWER_KEY: Record<
  number,
  { optimal: CampaignId; why: string; distractor: CampaignId; tempting: string; weakness: string }
> = {
  1: {
    optimal: "E",
    why: "Conversion tertinggi (75), CPA terendah ($1.80), Conv Rate solid (17.86%).",
    distractor: "D",
    tempting: "Conv Rate 20% tertinggi",
    weakness: "Volume conversion rendah (40) dan CTR sangat rendah (5.0%).",
  },
  2: {
    optimal: "E",
    why: "Conversion tertinggi (80), CPA terendah ($1.60), Conv Rate 20.51% (kedua setelah D 21.11%).",
    distractor: "D",
    tempting: "Conv Rate 21.11% tertinggi + CPA $2.60",
    weakness: "Volume conversion rendah (38).",
  },
  3: {
    optimal: "E",
    why: "Conversion tertinggi (85), CPA terendah ($1.70 vs D $2.40), Conv Rate solid (18.89%).",
    distractor: "C",
    tempting: "CTR 12.6% tertinggi",
    weakness: "Conversion rendah (28) dan CPA tinggi ($3.50).",
  },
  4: {
    optimal: "E",
    why: "Conversion tertinggi (78), CPA terendah ($1.90), Conv Rate tertinggi (19.50%).",
    distractor: "A",
    tempting: "CPA $2.90 cukup rendah",
    weakness: "Volume conversion hanya 30.",
  },
  5: {
    optimal: "E",
    why: "Conversion tertinggi (82), CPA terendah ($1.75), Conv Rate solid (19.07%).",
    distractor: "D",
    tempting: "Conv Rate 20.95% tertinggi",
    weakness: "Volume conversion hanya 44.",
  },
};
