/**
 * Convert model output to clean plain text. Gemini is asked not to use markdown, but models still slip in
 * `**bold**`, `# headings` or `* bullets`; users should never see the raw symbols.
 */
export function toPlainText(input: string, { atLineStart = true } = {}): string {
  // When the text continues a line already sent, a leading NUL stops line-anchored rules (^#, ^- …) firing on it.
  const guarded = atLineStart ? input : `\u0000${input}`;
  return (
    guarded
      // fenced code: keep the content, drop the fences
      .replace(/```[a-z]*\n?/gi, "")
      .replace(/`([^`\n]+)`/g, "$1")
      // links and images: keep the label
      .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
      // headings and block quotes
      .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
      .replace(/^[ \t]*>[ \t]?/gm, "")
      // bullets → "• ", numbered lists stay as they are
      .replace(/^([ \t]*)[-*+][ \t]+/gm, "$1• ")
      // bold / italic / strike
      .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "$2")
      .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?!\w)/g, "$1$2")
      .replace(/(^|[^\w_])_(?=\S)([^_\n]*?\S)_(?!\w)/g, "$1$2")
      .replace(/~~([^~]+)~~/g, "$1")
      // any leftover markers, e.g. an unclosed "**" while streaming
      .replace(/\*\*|__/g, "")
      .replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\u0000/g, "")
  );
}

const count = (text: string, token: string): number => text.split(token).length - 1;

/**
 * Streaming-safe sanitiser. Markdown markers can be split across chunks, so text is released at the last newline,
 * or mid-line at the last space once no bold/code span is left open. Users see words appear as they're written,
 * never a stray "**".
 */
export class PlainTextStream {
  private buffer = "";
  private atLineStart = true;

  push(chunk: string): string {
    this.buffer += chunk;
    let cut = this.buffer.lastIndexOf("\n");
    if (cut < 0 && this.buffer.length >= 24) {
      const space = this.buffer.lastIndexOf(" ");
      const candidate = this.buffer.slice(0, space + 1);
      // hold back while a bold or code span is still open, or the line may still become a bullet/heading
      const balanced =
        count(candidate, "**") % 2 === 0 &&
        count(candidate, "`") % 2 === 0 &&
        count(candidate, "__") % 2 === 0;
      const safeStart = !this.atLineStart || !/^\s*([-*+#>]|\d+\.)?\s*$/.test(candidate.slice(0, 3));
      if (space > 0 && balanced && safeStart) cut = space;
    }
    if (cut < 0) return "";
    return this.release(cut + 1);
  }

  flush(): string {
    return this.release(this.buffer.length);
  }

  private release(end: number): string {
    const ready = this.buffer.slice(0, end);
    this.buffer = this.buffer.slice(end);
    const out = toPlainText(ready, { atLineStart: this.atLineStart });
    if (ready.length > 0) this.atLineStart = ready.endsWith("\n");
    return out;
  }
}
