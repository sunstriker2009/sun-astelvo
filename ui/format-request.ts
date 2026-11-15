import { validFormatInput } from './format-contract.ts';
import type { FormatResult } from './format-contract.ts';
export async function handleRequest(value: unknown, format: (content: string, cursorOffset: number) => FormatResult | Promise<FormatResult>) {
  let id: number | null = null;
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid formatting request.');
    const request = value as {id: number; content: string; cursorOffset: number};
    if (Object.keys(request).length !== 3 || !['id', 'content', 'cursorOffset'].every(key => Object.hasOwn(request, key))
      || !Number.isSafeInteger(request.id) || request.id < 1) throw new Error('Invalid formatting request.');
    id = request.id;
    if (!validFormatInput(request.content, request.cursorOffset)) throw new Error('Formatting requires a valid cursor and at most 256 KiB of UTF-8 source.');
    return {id, ok: true as const, ...await format(request.content, request.cursorOffset)};
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.split('\n')[0].slice(0, 400) : 'Formatting failed.';
    return {id, ok: false as const, message: message || 'Formatting failed.'};
  }
}
