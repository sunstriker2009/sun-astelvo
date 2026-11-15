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
  'folder.create': ['name', 'parentId'], 'folder.rename': ['id', 'name'], 'folder.move': ['id', 'parentId'],
  'folder.duplicate': ['id', 'name', 'parentId', 'expectedRevision'],
  'script.create': ['name', 'language', 'folderId'], 'script.read': ['id'],
  'script.duplicate': ['id', 'name', 'folderId', 'expectedHash'],
  'folder.delete': ['id', 'expectedRevision', 'allowUpgrade'],
  'folder.restore': ['id', 'name', 'parentId', 'expectedRevision'],
  'collection.create': ['name', 'filter', 'expectedRevision', 'allowUpgrade'],
  'collection.update': ['id', 'name', 'filter', 'expectedRevision'],
  'collection.delete': ['id', 'expectedRevision'],
  'script.classify': ['id', 'tags', 'favourite', 'expectedRevision', 'allowUpgrade'],
  'script.delete': ['id', 'expectedHash', 'expectedRevision', 'allowUpgrade'],
  'script.restore': ['id', 'name', 'folderId', 'expectedRevision'],
  'script.save': ['id', 'name', 'language', 'folderId', 'content', 'expectedHash']
};
export function assertRequest(method, params) {
  if (!Object.hasOwn(shapes, method) || !fields(params, shapes[method])) throw new Error('Unsupported or invalid workspace request');
  for (const [key, value] of Object.entries(params)) {
    const valid = key === 'path' ? typeof value === 'string' && value.length > 0 && value.length <= 4096
      : key === 'create' || key === 'allowUpgrade' || key === 'favourite' ? typeof value === 'boolean'
      : key === 'filter' ? collectionFilter(value)
      : key === 'tags' ? tags(value)
      : key === 'id' ? id(value)
      : key === 'folderId' || key === 'parentId' ? optionalId(value)
      : key === 'name' ? name(value)
      : key === 'language' ? language(value)
      : key === 'expectedHash' ? hash(value)
      : key === 'expectedRevision' ? Number.isSafeInteger(value) && value >= 0
      : key === 'content' ? typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= MAX_SOURCE : false;
    if (!valid) throw new Error(`Invalid ${key}`);
  }
}
function tags(value) {
  return Array.isArray(value) && value.length <= 16 && value.every(tag => typeof tag === 'string' && tag.length > 0 && tag.length <= 40 && tag.trim() === tag && !/[\x00-\x1f\x7f-\x9f,]/.test(tag))
    && new Set(value.map(tag => tag.toLowerCase())).size === value.length;
}
function classification(value) { return fields(value, ['tags', 'favourite']) && tags(value.tags) && typeof value.favourite === 'boolean'; }
function script(value) {
  return object(value) && id(value.id) && name(value.name) && language(value.language) && optionalId(value.folderId) && hash(value.sourceHash) && (value.classification === undefined || classification(value.classification));
}
function folder(value) { return object(value) && id(value.id) && name(value.name) && optionalId(value.parentId); }
function tree(value) {
  return object(value) && id(value.rootId) && Array.isArray(value.folders) && value.folders.length > 0 && value.folders.every(folder)
    && value.folders.some(f => f.id === value.rootId) && Array.isArray(value.scripts) && value.scripts.every(script)
    && Array.isArray(value.deletedScripts) && value.deletedScripts.every(script);
}
function collectionFilter(value) {
  return fields(value, ['nameContains', 'language', 'folderId', 'tag', 'favouritesOnly'])
    && typeof value.nameContains === 'string' && value.nameContains.length <= 120 && value.nameContains.trim() === value.nameContains && !/[\x00-\x1f\x7f-\x9f]/.test(value.nameContains)
    && (value.language === null || language(value.language)) && optionalId(value.folderId)
    && (value.tag === null || tags([value.tag])) && typeof value.favouritesOnly === 'boolean';
}
function collection(value) { return fields(value, ['id', 'name', 'filter']) && id(value.id) && name(value.name) && collectionFilter(value.filter); }
function sameFilter(a, b) { return ['nameContains', 'language', 'folderId', 'tag', 'favouritesOnly'].every(key => a[key] === b[key]); }
function snapshot(value) {
  return object(value) && typeof value.root === 'string' && [1, 2, 3, 4, 5].includes(value.schemaVersion) && id(value.id) && name(value.name)
    && Number.isSafeInteger(value.revision) && value.revision >= 0
    && Array.isArray(value.folders) && value.folders.length <= 200 && value.folders.every(folder)
    && Array.isArray(value.scripts) && value.scripts.length <= 1000 && value.scripts.every(script)
    && (value.schemaVersion === 1 ? value.deletedScripts === undefined || Array.isArray(value.deletedScripts) && value.deletedScripts.length === 0
      : Array.isArray(value.deletedScripts) && value.scripts.length + value.deletedScripts.length <= 1000 && value.deletedScripts.every(script))
    && (value.schemaVersion < 3 ? value.deletedFolderTrees === undefined || Array.isArray(value.deletedFolderTrees) && value.deletedFolderTrees.length === 0
      : Array.isArray(value.deletedFolderTrees) && value.deletedFolderTrees.every(tree)
        && value.folders.length + value.deletedFolderTrees.reduce((n, t) => n + t.folders.length, 0) <= 200
        && value.scripts.length + value.deletedScripts.length + value.deletedFolderTrees.reduce((n, t) => n + t.scripts.length + t.deletedScripts.length, 0) <= 1000)
    && (value.schemaVersion < 4 || [...value.scripts, ...value.deletedScripts, ...value.deletedFolderTrees.flatMap(t => [...t.scripts, ...t.deletedScripts])].every(s => classification(s.classification)))
    && (value.schemaVersion < 5 ? value.collections === undefined || Array.isArray(value.collections) && value.collections.length === 0
      : Array.isArray(value.collections) && value.collections.length <= 100 && value.collections.every(collection));
}
function document(value) {
  return object(value) && id(value.id) && name(value.name) && language(value.language) && optionalId(value.folderId)
    && typeof value.content === 'string' && Buffer.byteLength(value.content, 'utf8') <= MAX_SOURCE && hash(value.hash) && typeof value.externalChanged === 'boolean' && (value.classification === undefined || classification(value.classification));
}
export function assertResult(method, value, params) {
  const valid = method === 'host.info' ? value?.product === 'ASTELVO' && value?.protocol === 1 && typeof value?.runtime === 'string'
    : method === 'workspace.close' ? value === null
    : ['workspace.open', 'folder.create', 'folder.rename', 'folder.move'].includes(method) ? snapshot(value)
    : method === 'collection.create' ? object(value) && snapshot(value.workspace) && value.workspace.schemaVersion === 5 && id(value.collectionId)
      && value.workspace.revision === params.expectedRevision + 1 && value.workspace.collections.some(c => c.id === value.collectionId && c.name === params.name && sameFilter(c.filter, params.filter))
    : method === 'collection.update' ? snapshot(value) && value.schemaVersion === 5 && value.revision === params.expectedRevision + 1
      && value.collections.some(c => c.id === params.id && c.name === params.name && sameFilter(c.filter, params.filter))
    : method === 'collection.delete' ? snapshot(value) && value.schemaVersion === 5 && value.revision === params.expectedRevision + 1 && !value.collections.some(c => c.id === params.id)
    : method === 'folder.duplicate' ? object(value) && snapshot(value.workspace) && id(value.folderId) && value.folderId !== params.id
      && value.workspace.revision === params.expectedRevision + 1
      && value.workspace.folders.some(f => f.id === value.folderId && f.name === params.name && f.parentId === params.parentId)
    : method === 'folder.delete' ? snapshot(value) && value.schemaVersion >= 3 && value.revision === params.expectedRevision + 1
      && !value.folders.some(f => f.id === params.id) && value.deletedFolderTrees.some(t => t.rootId === params.id)
    : method === 'folder.restore' ? snapshot(value) && value.schemaVersion >= 3 && value.revision === params.expectedRevision + 1
      && !value.deletedFolderTrees.some(t => t.rootId === params.id) && value.folders.some(f => f.id === params.id && f.name === params.name && f.parentId === params.parentId)
    : method === 'script.classify' ? snapshot(value) && value.schemaVersion >= 4 && value.revision === params.expectedRevision + 1
      && value.scripts.some(s => s.id === params.id && s.classification.favourite === params.favourite && JSON.stringify(s.classification.tags) === JSON.stringify(params.tags))
    : method === 'script.delete' ? snapshot(value) && value.schemaVersion >= 2 && value.revision === params.expectedRevision + 1
      && !value.scripts.some(s => s.id === params.id) && value.deletedScripts.some(s => s.id === params.id && s.sourceHash === params.expectedHash)
    : method === 'script.restore' ? snapshot(value) && value.schemaVersion >= 2 && value.revision === params.expectedRevision + 1
      && !value.deletedScripts.some(s => s.id === params.id) && value.scripts.some(s => s.id === params.id && s.name === params.name && s.folderId === params.folderId)
    : method === 'script.read' ? document(value) && value.id === params.id
    : ['script.create', 'script.save', 'script.duplicate'].includes(method) ? object(value) && snapshot(value.workspace) && document(value.document)
      && (method !== 'script.save' || value.document.id === params.id)
      && (method !== 'script.duplicate' || (value.document.id !== params.id && value.document.name === params.name && value.document.folderId === params.folderId && value.document.hash === params.expectedHash)) : false;
  if (!valid) throw new Error('Invalid host result');
}
