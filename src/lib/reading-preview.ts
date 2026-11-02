import { countWords } from "./content-lengths";

const sentences = new Intl.Segmenter("en", { granularity: "sentence" });

/** Display-only prefix. Original paragraphs are always retained for expansion. */
export function getReadingPreview(paragraphs: string[], maxWords: number): { paragraphs: string[]; truncated: boolean } {
  if (paragraphs.reduce((total, paragraph) => total + countWords(paragraph), 0) <= maxWords) {
    return { paragraphs, truncated: false };
  }
  const preview: string[] = [];
  let remaining = maxWords;
  for (const paragraph of paragraphs) {
    const words = countWords(paragraph);
    if (words <= remaining) {
      preview.push(paragraph);
      remaining -= words;
      continue;
    }
    let end = 0;
    for (const sentence of sentences.segment(paragraph)) {
      const length = countWords(sentence.segment);
      if (length > remaining) break;
      end = sentence.index + sentence.segment.length;
      remaining -= length;
    }
    if (end) preview.push(paragraph.slice(0, end).trimEnd());
    // A single very long sentence still needs a bounded preview, without splitting a word.
    if (!preview.length) {
      const words = [...paragraph.matchAll(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)];
      const last = words[Math.max(0, maxWords - 1)];
      if (last) preview.push(paragraph.slice(0, last.index + last[0].length) + "…");
    }
    break;
  }
  return { paragraphs: preview, truncated: true };
}
