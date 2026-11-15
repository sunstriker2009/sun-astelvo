export const maxFormatBytes = 256 * 1024;
export function validFormatInput(content: unknown, cursorOffset: unknown): content is string {
  return typeof content === 'string' && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(content) && content.length <= maxFormatBytes && new TextEncoder().encode(content).length <= maxFormatBytes
    && typeof cursorOffset === 'number' && Number.isInteger(cursorOffset) && cursorOffset >= 0 && cursorOffset <= content.length;
}
export type FormatResult = { formatted: string; cursorOffset: number };
export function validFormatResult(value: unknown): value is FormatResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as FormatResult;
  return validFormatInput(result.formatted, result.cursorOffset);
}
