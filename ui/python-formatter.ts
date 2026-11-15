import { initSync, Workspace, PositionEncoding } from '@astral-sh/ruff-wasm-web';
import { validFormatInput, validFormatResult } from './format-contract.ts';
import type { FormatResult } from './format-contract.ts';
import { handleRequest } from './format-request.ts';
let initialized = false;
export function initializePython(bytes: BufferSource) {
  if (!initialized) { initSync({module: bytes}); initialized = true; }
}
// Ruff's WASM API has no cursor source map. Keep exact unchanged prefix/suffix
// positions, otherwise retain a bounded line/column approximation.
export function pythonCursor(before: string, after: string, offset: number): number {
  let prefix = 0, suffix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  if (offset <= prefix) return offset;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix++;
  if (offset >= before.length - suffix) return after.length - (before.length - offset);
  const position = before.slice(0, offset).split(/\r\n|\r|\n/);
  const lines = after.split(/\r\n|\r|\n/);
  const row = Math.min(position.length - 1, lines.length - 1), column = Math.min(position.at(-1)!.length, lines[row].length);
  let start = 0;
  for (let i = 0; i < row; i++) { start += lines[i].length; start += after.startsWith('\r\n', start) ? 2 : 1; }
  return start + column;
}
export function formatPython(content: string, cursorOffset: number): FormatResult {
  if (!validFormatInput(content, cursorOffset)) throw new Error('Formatting requires a valid cursor and at most 256 KiB of UTF-8 source.');
  if (!initialized) throw new Error('Python formatter unavailable. Original buffer retained.');
  const workspace = new Workspace({'line-length': 88, 'indent-width': 4, 'target-version': 'py310', preview: false,
    format: {'indent-style': 'space', 'quote-style': 'double', 'line-ending': 'auto', 'docstring-code-format': false}}, PositionEncoding.Utf16);
  try {
    const bom = content.startsWith('\ufeff');
    const formatted = (bom ? '\ufeff' : '') + workspace.format(bom ? content.slice(1) : content);
    const result = {formatted, cursorOffset: pythonCursor(content, formatted, cursorOffset)};
    if (!validFormatResult(result)) throw new Error('Formatted output exceeds the 256 KiB source limit. Original buffer retained.');
    return result;
  } finally { workspace.free(); }
}
export function handlePythonRequest(value: unknown, initialize: () => void) {
  return handleRequest(value, (content, cursor) => { initialize(); return formatPython(content, cursor); });
}
