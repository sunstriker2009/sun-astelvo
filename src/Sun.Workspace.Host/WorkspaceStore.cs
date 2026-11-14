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
internal sealed record Script(Guid Id, string Name, string Language, Guid? FolderId, string SourceHash);
internal sealed record Manifest
{
    public required string Format { get; init; }
    public required int SchemaVersion { get; init; }
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public required long Revision { get; init; }
    public required List<Folder> Folders { get; init; }
    public required List<Script> Scripts { get; init; }
}

internal sealed class WorkspaceStore : IDisposable
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

    public object Snapshot() => new { root = Root, manifest.SchemaVersion, manifest.Id, manifest.Name, manifest.Revision, manifest.Folders, manifest.Scripts };

    public void Refresh()
    {
        var data = ReadBytes(ManifestPath, MaxManifestBytes);
        var next = ParseManifest(data);
        Validate(next);
        if (next.Id != manifest.Id) throw Error("conflict", "The workspace identity changed. Close it before opening the replacement.");
        manifest = next; manifestHash = Hash(data);
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

    public object CreateScript(string name, string language, Guid? folderId)
    {
        var script = new Script(Guid.NewGuid(), Name(name), Language(language), folderId, Hash([]));
        var next = manifest with { Scripts = [.. manifest.Scripts, script] };
        Validate(next);
        CheckManifest();
        WriteRevision(script, []);
        Commit(next);
        return new { workspace = Snapshot(), document = ReadScript(script.Id) };
    }

    public object ReadScript(Guid id)
    {
        CheckManifest();
        var script = Find(id);
        var bytes = ReadBytes(SourcePath(script), MaxSourceBytes);
        var hash = Hash(bytes);
        return new { script.Id, script.Name, script.Language, script.FolderId, content = Utf8.GetString(bytes), hash, externalChanged = hash != script.SourceHash };
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
        Validate(next);
        WriteRevision(script, bytes);
        // Recheck before the manifest commit so ordinary external edits made
        // during the revision write are detected as well.
        if (Hash(ReadBytes(SourcePath(original), MaxSourceBytes)) != expectedHash)
            throw Error("conflict", "The source changed during save. Reopen it to review; your buffer was not discarded.");
        Commit(next);
        return new { workspace = Snapshot(), document = ReadScript(id) };
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
        if (value.Format != "astelvo-workspace" || value.SchemaVersion != 1 || value.Id == Guid.Empty || value.Revision is < 0 or > 9_007_199_254_740_991 || value.Folders == null || value.Scripts == null)
            throw Error("invalid_workspace", "Unsupported or invalid workspace manifest.");
        Name(value.Name);
        if (value.Folders.Count > 200 || value.Scripts.Count > 1000) throw Error("limit_exceeded", "Preview limit: 200 folders and 1,000 scripts.");
        var ids = new HashSet<Guid>();
        var folders = new Dictionary<Guid, Folder>();
        foreach (var f in value.Folders)
        {
            if (f == null || f.Id == Guid.Empty || !ids.Add(f.Id)) throw Error("invalid_workspace", "Invalid or duplicate folder identity.");
            Name(f.Name); folders.Add(f.Id, f);
        }
        foreach (var f in value.Folders)
        {
            var seen = new HashSet<Guid> { f.Id };
            var parent = f.ParentId;
            while (parent != null)
            {
                if (!seen.Add(parent.Value) || !folders.TryGetValue(parent.Value, out var ancestor)) throw Error("invalid_workspace", "Folder hierarchy is invalid.");
                parent = ancestor.ParentId;
            }
        }
        foreach (var s in value.Scripts)
        {
            if (s == null || s.Id == Guid.Empty || !ids.Add(s.Id) || s.FolderId != null && !folders.ContainsKey(s.FolderId.Value) || !ValidHash(s.SourceHash))
                throw Error("invalid_workspace", "Invalid script identity, folder or content reference.");
            Name(s.Name); Language(s.Language);
        }
        if (value.Folders.GroupBy(f => (f.ParentId, f.Name.ToUpperInvariant())).Any(g => g.Count() > 1) || value.Scripts.GroupBy(s => (s.FolderId, s.Name.ToUpperInvariant())).Any(g => g.Count() > 1))
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
