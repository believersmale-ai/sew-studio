/** Studio-owned quotation labour defaults. Values are snapshots when a quote is saved. */
export type GarmentLabourRate = { name: string; baseLabour: number };
export type QuoteComplexityLevel = { name: string; multiplier: number };

export const DEFAULT_GARMENT_LABOUR: GarmentLabourRate[] = [
  { name: "Gown", baseLabour: 600 }, { name: "Suit", baseLabour: 800 },
  { name: "Dress", baseLabour: 500 }, { name: "Agbada", baseLabour: 700 },
  { name: "Skirt Set", baseLabour: 450 }, { name: "Slit & Koba", baseLabour: 500 },
  { name: "Shirt", baseLabour: 300 }, { name: "Trousers", baseLabour: 350 },
  { name: "Other", baseLabour: 500 },
];
export const DEFAULT_QUOTE_COMPLEXITIES: QuoteComplexityLevel[] = [
  { name: "Simple", multiplier: 1 }, { name: "Moderate", multiplier: 1.3 },
  { name: "Elaborate", multiplier: 1.6 }, { name: "Couture", multiplier: 2 },
];

export function parseGarmentLabour(value: unknown): GarmentLabourRate[] {
  if (!Array.isArray(value)) return DEFAULT_GARMENT_LABOUR.map(x => ({ ...x }));
  return value.map(x => ({ name: String(x?.name ?? "").trim(), baseLabour: Number(x?.baseLabour) }))
    .filter(x => x.name.length > 0 && x.name.length <= 80 && Number.isFinite(x.baseLabour) && x.baseLabour >= 0 && x.baseLabour <= 10000000);
}
export function parseQuoteComplexities(value: unknown): QuoteComplexityLevel[] {
  if (!Array.isArray(value)) return DEFAULT_QUOTE_COMPLEXITIES.map(x => ({ ...x }));
  return value.map(x => ({ name: String(x?.name ?? "").trim(), multiplier: Number(x?.multiplier) }))
    .filter(x => x.name.length > 0 && x.name.length <= 80 && Number.isFinite(x.multiplier) && x.multiplier > 0 && x.multiplier <= 100);
}
export function validateQuotePricing(garments: GarmentLabourRate[], levels: QuoteComplexityLevel[]): string | null {
  if (!garments.length || !levels.length) return "Keep at least one garment and one complexity level.";
  if (garments.length > 100 || levels.length > 30) return "Too many pricing entries.";
  for (const entries of [garments, levels]) {
    const names = entries.map(x => x.name.trim().toLocaleLowerCase());
    if (names.some(x => !x) || new Set(names).size !== names.length) return "Names must be filled in and unique.";
  }
  return null;
}
