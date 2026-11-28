import { eras, works } from "./data";
import {metadataFor,validLiteraryMetadata} from "./world-literature";

export type Material = typeof works[number];
export type MaterialRow = { id: string; data: string; deleted: number };

export function validMaterialId(id: unknown): id is string {
  return typeof id === "string" && (works.some(w => w.id === id) || /^material_[a-zA-Z0-9_-]{1,80}$/.test(id));
}

export function validateMaterial(value: unknown): Material | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!validMaterialId(input.id) || !validLiteraryMetadata(input)) return null;
  const required = ["title", "author", "era", "theme", "brief"] as const;
  if (required.some(key => typeof input[key] !== "string" || !(input[key] as string).trim())) return null;
  const limits: Record<string, number> = { title: 200, author: 200, era: 20, theme: 100, brief: 2000, guide: 20000, question: 2000, source: 2000, sourceName: 200 };
  for (const [key, limit] of Object.entries(limits)) {
    if (typeof input[key] !== "string" || (input[key] as string).length > limit) return null;
  }
  if (!eras.some(e => e.title === input.era)) return null;
  if (!Array.isArray(input.angles) || input.angles.length > 20 || input.angles.some(a => typeof a !== "string" || a.length > 2000)) return null;
  const source = (input.source as string).trim();
  if (source) {
    try { const url = new URL(source); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null; } catch { return null; }
  }
  return {
    id: input.id, title: (input.title as string).trim(), author: (input.author as string).trim(), era: (input.era as string).trim(),
    theme: (input.theme as string).trim(), brief: (input.brief as string).trim(), guide: (input.guide as string).trim(),
    question: (input.question as string).trim(), angles: (input.angles as string[]).map(a => a.trim()).filter(Boolean),
    source, sourceName: (input.sourceName as string).trim(),
    ...metadataFor(input as unknown as Material,works.find(w=>w.id===input.id)),
  };
}

export function mergeMaterials(rows: MaterialRow[]): Material[] {
  const merged = new Map(works.map(w => [w.id, w]));
  for (const row of rows) {
    if (row.deleted) { merged.delete(row.id); continue; }
    const data = validateMaterial(JSON.parse(row.data));
    if (!data || data.id !== row.id) throw new Error("Invalid stored material");
    merged.set(row.id, data);
  }
  return [...merged.values()];
}
