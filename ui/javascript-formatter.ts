import { handleRequest } from './format-request.ts';
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
export function handleFormatRequest(value: unknown) { return handleRequest(value, formatJavascript); }
