import bytes from '@astral-sh/ruff-wasm-web/ruff_wasm_bg.wasm';
import { initializePython, handlePythonRequest } from './python-formatter';
const scope = self as unknown as {onmessage: ((event: MessageEvent<unknown>) => void) | null; postMessage: (value: unknown) => void};
scope.onmessage = async event => { scope.postMessage(await handlePythonRequest(event.data, () => initializePython(bytes))); };
