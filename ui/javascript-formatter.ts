import { formatWithCursor } from 'prettier/standalone';
import * as babel from 'prettier/plugins/babel';
import * as estree from 'prettier/plugins/estree';
import { validFormatInput, validFormatResult } from './format-contract.ts';
import type { FormatResult } from './format-contract.ts';

export async function formatJavascript(content: string, cursorOffset: number): Promise<FormatResult> {
  if (!validFormatInput(content, cursorOffset)) throw new Error('Formatting requires a valid cursor and at most 256 KiB of UTF-8 source.');
  const result = await formatWithCursor(content, { parser: 'babel', plugins: [babel, estree], cursorOffset,
    printWidth: 80, tabWidth: 2, useTabs: false, semi: true, singleQuote: false, trailingComma: 'all', bracketSpacing: true,
    arrowParens: 'always', endOfLine: 'auto', embeddedLanguageFormatting: 'off' });
  if (!validFormatResult(result)) throw new Error('Formatted output exceeds the 256 KiB source limit. Original buffer retained.');
  return { formatted: result.formatted, cursorOffset: result.cursorOffset };
}
export async function handleFormatRequest(value: unknown) {
  let id: number | null = null;
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid formatting request.');
    const request = value as { id: number; content: string; cursorOffset: number };
    if (Object.keys(request).length !== 3 || !['id', 'content', 'cursorOffset'].every(key => Object.hasOwn(request, key))
      || !Number.isSafeInteger(request.id) || request.id < 1) throw new Error('Invalid formatting request.');
    id = request.id;
    const result = await formatJavascript(request.content, request.cursorOffset);
    return { id, ok: true as const, ...result };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.split('\n')[0].slice(0, 400) : 'JavaScript formatting failed.';
    return { id, ok: false as const, message };
  }
}
