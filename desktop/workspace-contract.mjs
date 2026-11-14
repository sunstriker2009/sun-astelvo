export const MAX_SOURCE = 256 * 1024;
const id = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value);
const optionalId = value => value === null || id(value);
const name = value => typeof value === 'string' && value.length > 0 && value.length <= 120 && value.trim() === value && !/[\x00-\x1f\x7f-\x9f/\\]/.test(value) && !['.', '..'].includes(value);
const language = value => ['javascript', 'python', 'csharp'].includes(value);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fields = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const shapes = {
  'host.info': [], 'workspace.open': ['path', 'create'], 'workspace.close': [],
  'folder.create': ['name', 'parentId'], 'folder.rename': ['id', 'name'],
  'script.create': ['name', 'language', 'folderId'], 'script.read': ['id'],
  'script.save': ['id', 'name', 'language', 'folderId', 'content', 'expectedHash']
};
export function assertRequest(method, params) {
  if (!Object.hasOwn(shapes, method) || !fields(params, shapes[method])) throw new Error('Unsupported or invalid workspace request');
  for (const [key, value] of Object.entries(params)) {
    const valid = key === 'path' ? typeof value === 'string' && value.length > 0 && value.length <= 4096
      : key === 'create' ? typeof value === 'boolean'
      : key === 'id' ? id(value)
      : key === 'folderId' || key === 'parentId' ? optionalId(value)
      : key === 'name' ? name(value)
      : key === 'language' ? language(value)
      : key === 'expectedHash' ? hash(value)
      : key === 'content' ? typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= MAX_SOURCE : false;
    if (!valid) throw new Error(`Invalid ${key}`);
  }
}
function snapshot(value) {
  return object(value) && typeof value.root === 'string' && value.schemaVersion === 1 && id(value.id) && name(value.name)
    && Number.isSafeInteger(value.revision) && value.revision >= 0
    && Array.isArray(value.folders) && value.folders.length <= 200 && value.folders.every(f => object(f) && id(f.id) && name(f.name) && optionalId(f.parentId))
    && Array.isArray(value.scripts) && value.scripts.length <= 1000 && value.scripts.every(s => object(s) && id(s.id) && name(s.name) && language(s.language) && optionalId(s.folderId) && hash(s.sourceHash));
}
function document(value) {
  return object(value) && id(value.id) && name(value.name) && language(value.language) && optionalId(value.folderId)
    && typeof value.content === 'string' && Buffer.byteLength(value.content, 'utf8') <= MAX_SOURCE && hash(value.hash) && typeof value.externalChanged === 'boolean';
}
export function assertResult(method, value, params) {
  const valid = method === 'host.info' ? value?.product === 'ASTELVO' && value?.protocol === 1 && typeof value?.runtime === 'string'
    : method === 'workspace.close' ? value === null
    : ['workspace.open', 'folder.create', 'folder.rename'].includes(method) ? snapshot(value)
    : method === 'script.read' ? document(value) && value.id === params.id
    : ['script.create', 'script.save'].includes(method) ? object(value) && snapshot(value.workspace) && document(value.document) && (method !== 'script.save' || value.document.id === params.id) : false;
  if (!valid) throw new Error('Invalid host result');
}
