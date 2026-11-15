using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sun.Workspace.Host;

internal sealed class WorkspaceException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

internal sealed record Folder(Guid Id, string Name, Guid? ParentId);
internal sealed record Classification(List<string> Tags, bool Favourite);
internal sealed record Script(Guid Id, string Name, string Language, Guid? FolderId, string SourceHash)
{
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public Classification? Classification { get; init; }
}
internal sealed record DeletedFolderTree(Guid RootId, List<Folder> Folders, List<Script> Scripts, List<Script> DeletedScripts);
internal sealed record CollectionFilter(string NameContains, string? Language, Guid? FolderId, string? Tag, bool FavouritesOnly);
internal sealed record SmartCollection(Guid Id, string Name, CollectionFilter Filter);
internal sealed record Manifest
{
    public required string Format { get; init; }
    public required int SchemaVersion { get; init; }
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public required long Revision { get; init; }
    public required List<Folder> Folders { get; init; }
    public required List<Script> Scripts { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<Script>? DeletedScripts { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<DeletedFolderTree>? DeletedFolderTrees { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<SmartCollection>? Collections { get; init; }
}

internal sealed partial class WorkspaceStore : IDisposable
{
    public const int MaxSourceBytes = 256 * 1024;
    private const int MaxManifestBytes = 1024 * 1024;
    private static readonly UTF8Encoding Utf8 = new(false, true);
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        RespectRequiredConstructorParameters = true
    };
    private static readonly Dictionary<string, string> Extensions = new()
    {
        ["javascript"] = ".js", ["python"] = ".py", ["csharp"] = ".cs"
    };
    public string Root { get; }
    private readonly FileStream lease;
    private Manifest manifest;
    private string manifestHash;
    private SourceSearchIndex? sourceIndex;
    private string? sourceIndexManifestHash;
    private string ManifestPath => Path.Combine(Root, "workspace.json");

    private WorkspaceStore(string root, FileStream lease, Manifest manifest, string hash)
    {
        Root = root; this.lease = lease; this.manifest = manifest; manifestHash = hash;
    }

    public static WorkspaceStore Open(string directory, bool create)
    {
        var root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(directory));
        if (OperatingSystem.IsWindows() && root.StartsWith(@"\\", StringComparison.Ordinal))
            throw Error("invalid_workspace", "Use a local folder; network workspaces are not supported in this preview.");
        PlainPath(root);
        if (!Directory.Exists(root)) throw Error("invalid_workspace", "Choose an existing local folder.");
        var lockPath = Path.Combine(root, ".astelvo-writer.lock");
        PlainPath(lockPath);
        FileStream lease;
        try { lease = new FileStream(lockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None); }
        catch (IOException) { throw Error("locked", "This workspace is already open in another ASTELVO instance, or its lock is unavailable."); }
        try
        {
            var manifestPath = Path.Combine(root, "workspace.json");
            if (create)
            {
                if (Directory.EnumerateFileSystemEntries(root).Any(p => p != lockPath))
                    throw Error("invalid_workspace", "Create a workspace in an empty folder. Existing files were not changed.");
                var initial = new Manifest { Format = "astelvo-workspace", SchemaVersion = 1, Id = Guid.NewGuid(), Name = new DirectoryInfo(root).Name, Revision = 0, Folders = [], Scripts = [] };
                initial = initial with { Name = Name(initial.Name.Length == 0 ? "Workspace" : initial.Name) };
                var store = new WorkspaceStore(root, lease, initial, "");
                Directory.CreateDirectory(Path.Combine(root, "scripts"));
                var bytes = JsonSerializer.SerializeToUtf8Bytes(initial, Json);
                AtomicWrite(manifestPath, bytes, false);
                store.manifestHash = Hash(bytes);
                return store;
            }
            var data = ReadBytes(manifestPath, MaxManifestBytes);
            var value = ParseManifest(data);
            Validate(value);
            PlainPath(Path.Combine(root, "scripts"));
            if (!Directory.Exists(Path.Combine(root, "scripts"))) throw Error("invalid_workspace", "The workspace scripts directory is missing.");
            return new WorkspaceStore(root, lease, value, Hash(data));
        }
        catch { lease.Dispose(); throw; }
    }

    public object Snapshot() => new { root = Root, manifest.SchemaVersion, manifest.Id, manifest.Name, manifest.Revision, manifest.Folders, manifest.Scripts, deletedScripts = manifest.DeletedScripts ?? [], deletedFolderTrees = manifest.DeletedFolderTrees ?? [], collections = manifest.Collections ?? [] };

    public void Refresh()
    {
        var data = ReadBytes(ManifestPath, MaxManifestBytes);
        var next = ParseManifest(data);
        Validate(next);
        if (next.Id != manifest.Id) throw Error("conflict", "The workspace identity changed. Close it before opening the replacement.");
        manifest = next; manifestHash = Hash(data);
    }

    public object SearchSource(string query, long expectedRevision, bool rebuild)
    {
        var terms = SourceSearchIndex.QueryTerms(query);
        CheckRevision(expectedRevision);
        var rebuilt = rebuild || sourceIndex == null || sourceIndexManifestHash != manifestHash;
        try
        {
            if (rebuilt)
            {
                sourceIndex = null;
                var candidate = new SourceSearchIndex();
                foreach (var script in manifest.Scripts)
                {
                    var bytes = VerifiedSearchSource(script);
                    candidate.Add(script.Id, Utf8.GetString(bytes), bytes.Length);
                }
                // Recheck all source bytes and metadata before publishing a complete cache.
                foreach (var script in manifest.Scripts) _ = VerifiedSearchSource(script);
                CheckManifest();
                sourceIndex = candidate; sourceIndexManifestHash = manifestHash;
            }
            else
            {
                // Application revisions are immutable, but external editors need not
                // honour that rule. Hash every active source even on warm queries.
                foreach (var script in manifest.Scripts) _ = VerifiedSearchSource(script);
                CheckManifest();
            }
            return new { workspaceId = manifest.Id, revision = manifest.Revision, query, scriptIds = sourceIndex!.Search(terms), sourceIndex.IndexedCount, sourceIndex.IndexedBytes, rebuilt };
        }
        catch { sourceIndex = null; sourceIndexManifestHash = null; throw; }
    }

    private byte[] VerifiedSearchSource(Script script)
    {
        var bytes = ReadBytes(SourcePath(script), MaxSourceBytes);
        if (Hash(bytes) != script.SourceHash) throw Error("conflict", "A saved source changed outside ASTELVO. Reload and save the reviewed script before searching. No external bytes were adopted or overwritten.");
        return bytes;
    }

    public object CreateFolder(string name, Guid? parentId)
    {
        var folder = new Folder(Guid.NewGuid(), Name(name), parentId);
        Commit(manifest with { Folders = [.. manifest.Folders, folder] });
        return Snapshot();
    }

    public object RenameFolder(Guid id, string name)
    {
        if (!manifest.Folders.Any(f => f.Id == id)) throw Error("not_found", "Folder not found.");
        var normalized = Name(name);
        Commit(manifest with { Folders = manifest.Folders.Select(f => f.Id == id ? f with { Name = normalized } : f).ToList() });
        return Snapshot();
    }

    public object MoveFolder(Guid id, Guid? parentId)
    {
        var folder = manifest.Folders.FirstOrDefault(f => f.Id == id) ?? throw Error("not_found", "Folder not found.");
        // Validate the entire proposed hierarchy before committing. This rejects
        // self/descendant moves, missing parents and sibling-name collisions.
        var next = manifest with { Folders = manifest.Folders.Select(f => f.Id == id ? folder with { ParentId = parentId } : f).ToList() };
        Validate(next);
        CheckManifest();
        if (folder.ParentId != parentId) Commit(next);
        return Snapshot();
    }

    public object CreateScript(string name, string language, Guid? folderId)
    {
        var script = new Script(Guid.NewGuid(), Name(name), Language(language), folderId, Hash([])) { Classification = manifest.SchemaVersion >= 4 ? new([], false) : null };
        var next = manifest with { Scripts = [.. manifest.Scripts, script] };
        PreflightCommit(next);
        CheckManifest();
        WriteRevision(script, []);
        Commit(next);
        return new { workspace = Snapshot(), document = ReadScript(script.Id) };
    }

    public object DuplicateFolder(Guid id, string name, Guid? parentId, long expectedRevision)
    {
        CheckManifest();
        if (manifest.Revision != expectedRevision) throw Error("conflict", "Workspace organization changed. Refresh it before duplicating a folder.");
        var original = manifest.Folders.FirstOrDefault(f => f.Id == id) ?? throw Error("not_found", "Folder not found.");
        var subtree = new HashSet<Guid> { id };
        var pending = new Queue<Guid>(); pending.Enqueue(id);
        while (pending.TryDequeue(out var parent))
            foreach (var child in manifest.Folders.Where(f => f.ParentId == parent))
                if (subtree.Add(child.Id)) pending.Enqueue(child.Id);
        if (parentId != null && subtree.Contains(parentId.Value))
            throw Error("invalid_request", "Choose a destination outside the folder being copied.");
        var folderIds = subtree.ToDictionary(oldId => oldId, _ => Guid.NewGuid());
        var copyName = Name(name);
        var folders = manifest.Folders.Where(f => subtree.Contains(f.Id)).Select(f => f with
        {
            Id = folderIds[f.Id], Name = f.Id == id ? copyName : f.Name,
            ParentId = f.Id == id ? parentId : folderIds[f.ParentId!.Value]
        }).ToList();
        var originals = manifest.Scripts.Where(s => s.FolderId != null && subtree.Contains(s.FolderId.Value)).ToList();
        var copies = originals.Select(s => s with { Id = Guid.NewGuid(), FolderId = folderIds[s.FolderId!.Value] }).ToList();
        var next = manifest with { Folders = [.. manifest.Folders, .. folders], Scripts = [.. manifest.Scripts, .. copies] };
        Validate(next);
        var committed = next with { Revision = checked(manifest.Revision + 1) };
        Validate(committed);
        if (JsonSerializer.SerializeToUtf8Bytes(committed, Json).Length > MaxManifestBytes)
            throw Error("limit_exceeded", "Workspace metadata exceeds the preview limit.");
        // Bound memory and preflight every source before staging any copy.
        const int maxCopyBytes = 8 * 1024 * 1024;
        var contents = new List<byte[]>();
        var totalBytes = 0;
        foreach (var script in originals)
        {
            var bytes = ReadBytes(SourcePath(script), MaxSourceBytes);
            if (Hash(bytes) != script.SourceHash) throw Error("conflict", "A folder source changed outside ASTELVO. Reload and save the reviewed script before copying.");
            _ = Utf8.GetString(bytes);
            totalBytes += bytes.Length;
            if (totalBytes > maxCopyBytes) throw Error("limit_exceeded", "Folder copies are limited to 8 MiB of source per operation in this preview.");
            contents.Add(bytes);
        }
        CheckManifest();
        for (var i = 0; i < copies.Count; i++) WriteRevision(copies[i], contents[i]);
        foreach (var script in originals)
            if (Hash(ReadBytes(SourcePath(script), MaxSourceBytes)) != script.SourceHash)
                throw Error("conflict", "A source changed during the folder copy. Review it before retrying; originals were not overwritten.");
        // One manifest commit exposes the whole new subtree, never a prefix.
        Commit(next);
        return new { workspace = Snapshot(), folderId = folderIds[original.Id] };
    }

    public object ReadScript(Guid id)
    {
        CheckManifest();
        var script = Find(id);
        var bytes = ReadBytes(SourcePath(script), MaxSourceBytes);
        var hash = Hash(bytes);
        return new { script.Id, script.Name, script.Language, script.FolderId, content = Utf8.GetString(bytes), hash, externalChanged = hash != script.SourceHash, classification = script.Classification ?? new([], false) };
    }

    public object DuplicateScript(Guid id, string name, Guid? folderId, string expectedHash)
    {
        CheckManifest();
        var original = Find(id);
        var bytes = ReadBytes(SourcePath(original), MaxSourceBytes);
        if (original.SourceHash != expectedHash || Hash(bytes) != expectedHash)
            throw Error("conflict", "The saved script changed. Reload and save the reviewed revision before duplicating it.");
        // Reject invalid UTF-8 before creating any copy; duplicate only the
        // committed revision, never an unseen external edit or renderer buffer.
        _ = Utf8.GetString(bytes);
        var copy = original with { Id = Guid.NewGuid(), Name = Name(name), FolderId = folderId };
        var next = manifest with { Scripts = [.. manifest.Scripts, copy] };
        PreflightCommit(next);
        WriteRevision(copy, bytes);
        if (Hash(ReadBytes(SourcePath(original), MaxSourceBytes)) != expectedHash)
            throw Error("conflict", "The source changed during duplication. Review it before retrying; the original was not overwritten.");
        Commit(next);
        return new { workspace = Snapshot(), document = ReadScript(copy.Id) };
    }

    public object SaveScript(Guid id, string name, string language, Guid? folderId, string content, string expectedHash)
    {
        CheckManifest();
        var original = Find(id);
        var current = ReadBytes(SourcePath(original), MaxSourceBytes);
        if (Hash(current) != expectedHash) throw Error("conflict", "This script changed outside ASTELVO. Your editor buffer is intact; reopen the script to review the external version.");
        var bytes = Utf8.GetBytes(content);
        if (bytes.Length > MaxSourceBytes) throw Error("limit_exceeded", "Scripts are limited to 256 KiB in this preview.");
        var script = original with { Name = Name(name), Language = Language(language), FolderId = folderId, SourceHash = Hash(bytes) };
        var next = manifest with { Scripts = manifest.Scripts.Select(s => s.Id == id ? script : s).ToList() };
        PreflightCommit(next);
        WriteRevision(script, bytes);
        // Recheck before the manifest commit so ordinary external edits made
        // during the revision write are detected as well.
        if (Hash(ReadBytes(SourcePath(original), MaxSourceBytes)) != expectedHash)
            throw Error("conflict", "The source changed during save. Reopen it to review; your buffer was not discarded.");
        Commit(next);
        return new { workspace = Snapshot(), document = ReadScript(id) };
    }

    public object DeleteScript(Guid id, string expectedHash, long expectedRevision, bool allowUpgrade)
    {
        CheckRevision(expectedRevision);
        var original = Find(id);
        VerifyCommittedSource(original, expectedHash);
        if (manifest.SchemaVersion == 1 && !allowUpgrade)
            throw Error("upgrade_required", "Script deletion requires workspace format v2. Confirm the upgrade; older ASTELVO builds cannot open v2 workspaces.");
        var next = manifest with
        {
            SchemaVersion = Math.Max(2, manifest.SchemaVersion),
            Scripts = manifest.Scripts.Where(s => s.Id != id).ToList(),
            DeletedScripts = [.. manifest.DeletedScripts ?? [], original]
        };
        PreflightCommit(next);
        BackupBeforeUpgrade(2);
        VerifyCommittedSource(original, expectedHash);
        Commit(next);
        return Snapshot();
    }

    public object RestoreScript(Guid id, string name, Guid? folderId, long expectedRevision)
    {
        CheckRevision(expectedRevision);
        var deleted = manifest.DeletedScripts?.FirstOrDefault(s => s.Id == id) ?? throw Error("not_found", "Deleted script not found.");
        var restored = deleted with { Name = Name(name), FolderId = folderId };
        var next = manifest with
        {
            Scripts = [.. manifest.Scripts, restored],
            DeletedScripts = manifest.DeletedScripts!.Where(s => s.Id != id).ToList()
        };
        PreflightCommit(next);
        VerifyCommittedSource(deleted, deleted.SourceHash);
        Commit(next);
        return Snapshot();
    }

    public object DeleteFolder(Guid id, long expectedRevision, bool allowUpgrade)
    {
        CheckRevision(expectedRevision);
        if (!manifest.Folders.Any(f => f.Id == id)) throw Error("not_found", "Folder not found.");
        if (manifest.SchemaVersion < 3 && !allowUpgrade)
            throw Error("upgrade_required", "Folder deletion requires workspace format v3. Confirm the upgrade; older ASTELVO builds cannot open v3 workspaces.");
        var subtree = new HashSet<Guid> { id };
        var pending = new Queue<Guid>(); pending.Enqueue(id);
        while (pending.TryDequeue(out var parent))
            foreach (var child in manifest.Folders.Where(f => f.ParentId == parent))
                if (subtree.Add(child.Id)) pending.Enqueue(child.Id);
        bool InSubtree(Script script) => script.FolderId is Guid folder && subtree.Contains(folder);
        var tree = new DeletedFolderTree(id, manifest.Folders.Where(f => subtree.Contains(f.Id)).ToList(),
            manifest.Scripts.Where(InSubtree).ToList(), (manifest.DeletedScripts ?? []).Where(InSubtree).ToList());
        var next = manifest with
        {
            SchemaVersion = Math.Max(3, manifest.SchemaVersion),
            Folders = manifest.Folders.Where(f => !subtree.Contains(f.Id)).ToList(),
            Scripts = manifest.Scripts.Where(s => !InSubtree(s)).ToList(),
            DeletedScripts = (manifest.DeletedScripts ?? []).Where(s => !InSubtree(s)).ToList(),
            DeletedFolderTrees = [.. manifest.DeletedFolderTrees ?? [], tree]
        };
        PreflightCommit(next);
        VerifyTreeSources(tree);
        BackupBeforeUpgrade(3);
        VerifyTreeSources(tree);
        Commit(next);
        return Snapshot();
    }

    public object RestoreFolder(Guid id, string name, Guid? parentId, long expectedRevision)
    {
        CheckRevision(expectedRevision);
        var tree = manifest.DeletedFolderTrees?.FirstOrDefault(t => t.RootId == id) ?? throw Error("not_found", "Deleted folder not found.");
        var rootName = Name(name);
        var folders = tree.Folders.Select(f => f.Id == id ? f with { Name = rootName, ParentId = parentId } : f).ToList();
        var next = manifest with
        {
            Folders = [.. manifest.Folders, .. folders],
            Scripts = [.. manifest.Scripts, .. tree.Scripts],
            DeletedScripts = [.. manifest.DeletedScripts ?? [], .. tree.DeletedScripts],
            DeletedFolderTrees = manifest.DeletedFolderTrees!.Where(t => t.RootId != id).ToList()
        };
        PreflightCommit(next);
        VerifyTreeSources(tree);
        Commit(next);
        return Snapshot();
    }

    public object ClassifyScript(Guid id, List<string> tags, bool favourite, long expectedRevision, bool allowUpgrade)
    {
        CheckRevision(expectedRevision);
        _ = Find(id);
        var classification = new Classification(tags, favourite);
        ValidateClassification(classification);
        if (manifest.SchemaVersion < 4 && !allowUpgrade)
            throw Error("upgrade_required", "Tags and favourites require workspace format v4. Confirm the upgrade; older ASTELVO builds cannot open v4 workspaces.");
        var next = UpgradeMetadata(4);
        next = next with { Scripts = next.Scripts.Select(script => script.Id == id ? script with { Classification = classification } : script).ToList() };
        PreflightCommit(next);
        BackupBeforeUpgrade(4);
        Commit(next);
        return Snapshot();
    }

    public object CreateCollection(string name, CollectionFilter filter, long expectedRevision, bool allowUpgrade)
    {
        CheckRevision(expectedRevision);
        if (manifest.SchemaVersion < 5 && !allowUpgrade)
            throw Error("upgrade_required", "Saved collections require workspace format v5. Confirm the upgrade; older ASTELVO builds cannot open v5 workspaces.");
        var collection = new SmartCollection(Guid.NewGuid(), Name(name), filter);
        var next = UpgradeMetadata(5);
        next = next with { Collections = [.. next.Collections!, collection] };
        PreflightCommit(next);
        BackupBeforeUpgrade(5);
        Commit(next);
        return new { workspace = Snapshot(), collectionId = collection.Id };
    }

    public object UpdateCollection(Guid id, string name, CollectionFilter filter, long expectedRevision)
    {
        CheckRevision(expectedRevision);
        if (!(manifest.Collections ?? []).Any(c => c.Id == id)) throw Error("not_found", "Collection not found.");
        var collection = new SmartCollection(id, Name(name), filter);
        Commit(manifest with { Collections = manifest.Collections!.Select(c => c.Id == id ? collection : c).ToList() });
        return Snapshot();
    }

    public object DeleteCollection(Guid id, long expectedRevision)
    {
        CheckRevision(expectedRevision);
        if (!(manifest.Collections ?? []).Any(c => c.Id == id)) throw Error("not_found", "Collection not found.");
        Commit(manifest with { Collections = manifest.Collections!.Where(c => c.Id != id).ToList() });
        return Snapshot();
    }

    private Manifest UpgradeMetadata(int minimumVersion)
    {
        if (manifest.SchemaVersion >= minimumVersion) return manifest;
        Script Upgrade(Script script) => script with { Classification = script.Classification ?? new([], false) };
        return manifest with
        {
            SchemaVersion = minimumVersion,
            Scripts = manifest.Scripts.Select(Upgrade).ToList(),
            DeletedScripts = (manifest.DeletedScripts ?? []).Select(Upgrade).ToList(),
            DeletedFolderTrees = (manifest.DeletedFolderTrees ?? []).Select(tree => tree with
            {
                Scripts = tree.Scripts.Select(Upgrade).ToList(), DeletedScripts = tree.DeletedScripts.Select(Upgrade).ToList()
            }).ToList(),
            Collections = minimumVersion >= 5 ? manifest.Collections ?? [] : manifest.Collections
        };
    }

    private static void ValidateCollectionFilter(CollectionFilter filter, HashSet<Guid> folders)
    {
        if (filter == null || filter.NameContains == null || filter.NameContains.Length > 120 || filter.NameContains != filter.NameContains.Trim()
            || filter.NameContains.Any(char.IsControl) || filter.FolderId != null && !folders.Contains(filter.FolderId.Value))
            throw Error("invalid_request", "Invalid collection name filter or folder scope.");
        if (filter.Language != null) Language(filter.Language);
        if (filter.Tag != null) ValidateClassification(new([filter.Tag], false));
    }

    private static void ValidateClassification(Classification value)
    {
        if (value.Tags == null || value.Tags.Count > 16 || value.Tags.Distinct(StringComparer.OrdinalIgnoreCase).Count() != value.Tags.Count
            || value.Tags.Any(tag => string.IsNullOrWhiteSpace(tag) || tag != tag.Trim() || tag.Length > 40 || tag.Any(c => char.IsControl(c) || c == ',')))
            throw Error("invalid_request", "Use up to 16 distinct tags, each 1–40 characters without commas, controls or surrounding whitespace.");
    }

    private void VerifyTreeSources(DeletedFolderTree tree)
    {
        // Stream one bounded file at a time, without accumulating subtree content.
        foreach (var script in tree.Scripts.Concat(tree.DeletedScripts)) VerifyCommittedSource(script, script.SourceHash);
    }

    private void BackupBeforeUpgrade(int targetVersion)
    {
        if (manifest.SchemaVersion >= targetVersion) return;
        var bytes = ReadBytes(ManifestPath, MaxManifestBytes);
        if (Hash(bytes) != manifestHash) throw Error("conflict", "Workspace metadata changed before upgrade.");
        var backup = Path.Combine(Root, $"workspace.v{manifest.SchemaVersion}.{manifestHash}.json");
        PlainPath(backup);
        if (File.Exists(backup))
        {
            if (!ReadBytes(backup, MaxManifestBytes).AsSpan().SequenceEqual(bytes))
                throw Error("conflict", "The workspace upgrade backup already exists with different bytes.");
        }
        else AtomicWrite(backup, bytes, false);
    }

    private void CheckRevision(long expectedRevision)
    {
        CheckManifest();
        if (manifest.Revision != expectedRevision) throw Error("conflict", "Workspace organization changed. Reopen it before deleting or restoring.");
    }

    private void VerifyCommittedSource(Script script, string expectedHash)
    {
        var bytes = ReadBytes(SourcePath(script), MaxSourceBytes);
        if (script.SourceHash != expectedHash || Hash(bytes) != expectedHash)
            throw Error("conflict", "The source changed outside ASTELVO. Review it before deleting or restoring; no source was overwritten.");
        _ = Utf8.GetString(bytes);
    }

    private Script Find(Guid id) => manifest.Scripts.FirstOrDefault(s => s.Id == id) ?? throw Error("not_found", "Script not found.");
    private string SourcePath(Script script) => Path.Combine(Root, "scripts", script.Id.ToString("D"), script.SourceHash + Extensions[script.Language]);

    private void WriteRevision(Script script, byte[] bytes)
    {
        var path = SourcePath(script);
        PlainPath(path);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        if (File.Exists(path))
        {
            if (Hash(ReadBytes(path, MaxSourceBytes)) != script.SourceHash) throw Error("conflict", "An existing content revision was externally modified. It was not overwritten.");
            return;
        }
        AtomicWrite(path, bytes, false);
    }

    private void CheckManifest()
    {
        if (Hash(ReadBytes(ManifestPath, MaxManifestBytes)) != manifestHash)
            throw Error("conflict", "Workspace metadata changed outside this instance. Reopen the same workspace to refresh it before saving.");
    }

    private void PreflightCommit(Manifest next)
    {
        var candidate = next with { Revision = checked(manifest.Revision + 1) };
        Validate(candidate);
        if (JsonSerializer.SerializeToUtf8Bytes(candidate, Json).Length > MaxManifestBytes)
            throw Error("limit_exceeded", "Workspace metadata exceeds the preview limit.");
    }

    private void Commit(Manifest next)
    {
        CheckManifest();
        next = next with { Revision = checked(manifest.Revision + 1) };
        Validate(next);
        var bytes = JsonSerializer.SerializeToUtf8Bytes(next, Json);
        if (bytes.Length > MaxManifestBytes) throw Error("limit_exceeded", "Workspace metadata exceeds the preview limit.");
        AtomicWrite(ManifestPath, bytes, true);
        manifest = next; manifestHash = Hash(bytes);
    }

    private static void AtomicWrite(string path, byte[] bytes, bool overwrite)
    {
        PlainPath(path);
        var temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                stream.Write(bytes); stream.Flush(true);
            }
            PlainPath(path);
            File.Move(temp, path, overwrite);
        }
        finally { if (File.Exists(temp)) File.Delete(temp); }
    }

    private static byte[] ReadBytes(string path, int limit)
    {
        PlainPath(path);
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        if (stream.Length > limit) throw Error("limit_exceeded", "Workspace file exceeds the preview size limit.");
        var bytes = new byte[checked((int)stream.Length)];
        stream.ReadExactly(bytes);
        if (stream.ReadByte() != -1) throw Error("conflict", "A workspace file changed while reading.");
        return bytes;
    }

    // Reject existing symlinks/junctions on managed paths. This is protection
    // against accidental path escape, not a hostile-filesystem security sandbox.
    private static void PlainPath(string path)
    {
        for (string? current = Path.GetFullPath(path); current != null; current = Path.GetDirectoryName(current))
        {
            try { if ((File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0) throw Error("invalid_workspace", "Symlinks and junctions are not supported for workspace storage."); }
            catch (FileNotFoundException) { }
            catch (DirectoryNotFoundException) { }
        }
    }

    private static void Validate(Manifest value)
    {
        if (value.Format != "astelvo-workspace" || value.SchemaVersion is not (1 or 2 or 3 or 4 or 5)
            || (value.SchemaVersion == 1 ? value.DeletedScripts != null : value.DeletedScripts == null)
            || (value.SchemaVersion < 3 ? value.DeletedFolderTrees != null : value.DeletedFolderTrees == null)
            || (value.SchemaVersion < 5 ? value.Collections != null : value.Collections == null)
            || value.Id == Guid.Empty || value.Revision is < 0 or > 9_007_199_254_740_991 || value.Folders == null || value.Scripts == null)
            throw Error("invalid_workspace", "Unsupported or invalid workspace manifest.");
        Name(value.Name);
        var trees = value.DeletedFolderTrees ?? [];
        if (trees.Any(t => t == null || t.Folders == null || t.Scripts == null || t.DeletedScripts == null))
            throw Error("invalid_workspace", "Invalid deleted folder tree.");
        if (value.Folders.Count + trees.Sum(t => t.Folders.Count) > 200
            || value.Scripts.Count + (value.DeletedScripts?.Count ?? 0) + trees.Sum(t => t.Scripts.Count + t.DeletedScripts.Count) > 1000)
            throw Error("limit_exceeded", "Preview limit: 200 folders and 1,000 scripts including the recycle bin.");
        var allScripts = value.Scripts.Concat(value.DeletedScripts ?? []).Concat(trees.SelectMany(t => t.Scripts.Concat(t.DeletedScripts)));
        foreach (var script in allScripts)
        {
            if (script == null || (value.SchemaVersion < 4 ? script.Classification != null : script.Classification == null))
                throw Error("invalid_workspace", "Classification metadata requires workspace schema v4 and is mandatory for every v4 script.");
            if (script.Classification != null) ValidateClassification(script.Classification);
        }
        var ids = new HashSet<Guid>();
        ValidatePartition(value.Folders, value.Scripts, value.DeletedScripts ?? [], ids);
        foreach (var tree in trees)
        {
            var root = tree.Folders.FirstOrDefault(f => f != null && f.Id == tree.RootId);
            if (root == null || root.ParentId == Guid.Empty || tree.Folders.Any(f => f != null && f.Id == root.ParentId))
                throw Error("invalid_workspace", "Invalid deleted folder root.");
            // The original parent is historical metadata: it may be deleted
            // independently later. Restore always chooses a live destination.
            var normalized = tree.Folders.Select(f => f != null && f.Id == tree.RootId ? f with { ParentId = null } : f!).ToList();
            ValidatePartition(normalized, tree.Scripts, tree.DeletedScripts, ids);
            if (normalized.Count(f => f.ParentId == null) != 1
                || tree.Scripts.Concat(tree.DeletedScripts).Any(s => s.FolderId == null))
                throw Error("invalid_workspace", "Deleted folder trees must be connected and contain only their own scripts.");
        }
        var collections = value.Collections ?? [];
        if (collections.Count > 100) throw Error("limit_exceeded", "Preview limit: 100 saved collections.");
        var folderIds = value.Folders.Concat(trees.SelectMany(t => t.Folders)).Select(f => f.Id).ToHashSet();
        foreach (var collection in collections)
        {
            if (collection == null || collection.Id == Guid.Empty || !ids.Add(collection.Id)) throw Error("invalid_workspace", "Invalid or duplicate collection identity.");
            Name(collection.Name); ValidateCollectionFilter(collection.Filter, folderIds);
        }
        if (collections.GroupBy(c => c.Name.ToUpperInvariant()).Any(g => g.Count() > 1))
            throw Error("invalid_request", "Collection names must be unique ignoring case.");
    }

    private static void ValidatePartition(List<Folder> folderList, List<Script> scripts, List<Script> deleted, HashSet<Guid> ids)
    {
        var folders = new Dictionary<Guid, Folder>();
        foreach (var f in folderList)
        {
            if (f == null || f.Id == Guid.Empty || !ids.Add(f.Id)) throw Error("invalid_workspace", "Invalid or duplicate folder identity.");
            Name(f.Name); folders.Add(f.Id, f);
        }
        foreach (var f in folderList)
        {
            var seen = new HashSet<Guid> { f.Id };
            var parent = f.ParentId;
            while (parent != null)
            {
                if (!seen.Add(parent.Value) || !folders.TryGetValue(parent.Value, out var ancestor)) throw Error("invalid_workspace", "Folder hierarchy is invalid.");
                parent = ancestor.ParentId;
            }
        }
        foreach (var script in scripts.Concat(deleted))
        {
            if (script == null || script.Id == Guid.Empty || !ids.Add(script.Id)
                || script.FolderId != null && !folders.ContainsKey(script.FolderId.Value) || !ValidHash(script.SourceHash))
                throw Error("invalid_workspace", "Invalid script identity, folder or content reference.");
            Name(script.Name); Language(script.Language);
        }
        if (folderList.GroupBy(f => (f.ParentId, f.Name.ToUpperInvariant())).Any(g => g.Count() > 1)
            || scripts.GroupBy(s => (s.FolderId, s.Name.ToUpperInvariant())).Any(g => g.Count() > 1))
            throw Error("invalid_request", "Names must be unique within their folder (ignoring case).");
    }

    private static Manifest ParseManifest(byte[] bytes)
    {
        using var document = JsonDocument.Parse(bytes);
        static void UniqueProperties(JsonElement value)
        {
            if (value.ValueKind == JsonValueKind.Object)
            {
                var seen = new HashSet<string>(StringComparer.Ordinal);
                foreach (var property in value.EnumerateObject())
                {
                    if (!seen.Add(property.Name)) throw Error("invalid_workspace", "Workspace manifest contains duplicate JSON properties.");
                    UniqueProperties(property.Value);
                }
            }
            else if (value.ValueKind == JsonValueKind.Array)
                foreach (var item in value.EnumerateArray()) UniqueProperties(item);
        }
        UniqueProperties(document.RootElement);
        if (document.RootElement.TryGetProperty("schemaVersion", out var schema) && schema.ValueKind == JsonValueKind.Number && schema.TryGetInt32(out var version) && version == 1 && document.RootElement.TryGetProperty("deletedScripts", out _))
            throw Error("invalid_workspace", "Recycle-bin metadata requires workspace schema v2.");
        if (document.RootElement.TryGetProperty("schemaVersion", out schema) && schema.ValueKind == JsonValueKind.Number && schema.TryGetInt32(out version) && version < 3 && document.RootElement.TryGetProperty("deletedFolderTrees", out _))
            throw Error("invalid_workspace", "Folder recycle-bin metadata requires workspace schema v3.");
        if (document.RootElement.TryGetProperty("schemaVersion", out schema) && schema.ValueKind == JsonValueKind.Number && schema.TryGetInt32(out version) && version < 4)
        {
            static bool HasClassification(JsonElement value) => value.ValueKind == JsonValueKind.Object
                ? value.EnumerateObject().Any(property => property.Name == "classification" || HasClassification(property.Value))
                : value.ValueKind == JsonValueKind.Array && value.EnumerateArray().Any(HasClassification);
            if (HasClassification(document.RootElement)) throw Error("invalid_workspace", "Classification metadata requires workspace schema v4.");
        }
        if (document.RootElement.TryGetProperty("schemaVersion", out schema) && schema.ValueKind == JsonValueKind.Number && schema.TryGetInt32(out version) && version < 5 && document.RootElement.TryGetProperty("collections", out _))
            throw Error("invalid_workspace", "Saved collections require workspace schema v5.");
        return JsonSerializer.Deserialize<Manifest>(bytes, Json) ?? throw Error("invalid_workspace", "Workspace manifest is missing.");
    }

    internal static string Name(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value != value.Trim() || value.Length > 120 || value is "." or ".." || value.Any(c => char.IsControl(c) || c is '/' or '\\'))
            throw Error("invalid_request", "Use a name of 1–120 characters, without slashes or surrounding whitespace.");
        return value;
    }
    internal static string Language(string? value) => value != null && Extensions.ContainsKey(value) ? value : throw Error("invalid_request", "Choose JavaScript, Python or C#.");
    internal static bool ValidHash(string? value) => value is { Length: 64 } && value.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');
    private static string Hash(byte[] bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));
    private static WorkspaceException Error(string code, string message) => new(code, message);
    public void Dispose() => lease.Dispose();
}
