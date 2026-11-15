import { handleFormatRequest } from './javascript-formatter';
const scope = self as unknown as { onmessage: ((event: MessageEvent<unknown>) => void) | null; postMessage: (value: unknown) => void };
scope.onmessage = async event => { scope.postMessage(await handleFormatRequest(event.data)); };
