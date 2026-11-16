using System.Text.Json;

namespace Sun.Workspace.Host;

internal sealed class WorkspaceSession : IDisposable
{
    private WorkspaceStore? workspace;
    public object? Execute(string method, JsonElement request)
    {
        if (method == "host.info") return new { product = "WORKBENCH", protocol = 1, runtime = Environment.Version.ToString() };
        var p = request.TryGetProperty("params", out var parameters) && parameters.ValueKind == JsonValueKind.Object ? parameters : throw Invalid();
        if (method == "workspace.open")
        {
            Keys(p, "path", "create");
            var path = Path.TrimEndingDirectorySeparator(Path.GetFullPath(Text(p, "path")));
            var create = p.GetProperty("create").GetBoolean();
            if (workspace != null && string.Equals(path, workspace.Root, OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal))
            {
                if (create) throw Invalid();
                workspace.Refresh(); return workspace.Snapshot();
            }
            var next = WorkspaceStore.Open(path, create);
            workspace?.Dispose(); workspace = next;
            return workspace.Snapshot();
        }
        if (method == "workspace.restore")
        {
            Keys(p, "archivePath", "path");
            var next = WorkspaceStore.RestoreArchive(Text(p, "archivePath"), Text(p, "path"));
            workspace?.Dispose(); workspace = next;
            return workspace.Snapshot();
        }
        if (method == "workspace.close") { Keys(p); workspace?.Dispose(); workspace = null; return null; }
        var active = workspace ?? throw new WorkspaceException("no_workspace", "Create or open a workspace first.");
        switch (method)
        {
            case "recovery.read":
                Keys(p); return active.ReadRecovery();
            case "recovery.write":
                Keys(p, "expectedToken", "snapshot");
                return active.WriteRecovery(Token(p), p.GetProperty("snapshot"));
            case "recovery.clear":
                Keys(p, "expectedToken"); return active.ClearRecovery(Token(p));
            case "workspace.import":
                Keys(p, "paths", "folderId", "expectedRevision", "renameConflicts");
                var paths = p.GetProperty("paths").EnumerateArray().Select(path => path.GetString() ?? throw Invalid()).ToList();
                return active.ImportScripts(paths, OptionalId(p, "folderId"), Revision(p), p.GetProperty("renameConflicts").GetBoolean());
            case "workspace.export":
                Keys(p, "archivePath", "expectedRevision");
                return active.ExportArchive(Text(p, "archivePath"), Revision(p));
            case "workspace.search":
                Keys(p, "query", "expectedRevision", "rebuild");
                return active.SearchSource(Text(p, "query"), Revision(p), p.GetProperty("rebuild").GetBoolean());
            case "collection.create":
                Keys(p, "name", "filter", "expectedRevision", "allowUpgrade");
                return active.CreateCollection(Text(p, "name"), Filter(p), Revision(p), p.GetProperty("allowUpgrade").GetBoolean());
            case "collection.update":
                Keys(p, "id", "name", "filter", "expectedRevision");
                return active.UpdateCollection(Id(p, "id"), Text(p, "name"), Filter(p), Revision(p));
            case "collection.delete":
                Keys(p, "id", "expectedRevision");
                return active.DeleteCollection(Id(p, "id"), Revision(p));
            case "folder.create":
                Keys(p, "name", "parentId"); return active.CreateFolder(Text(p, "name"), OptionalId(p, "parentId"));
            case "folder.rename":
                Keys(p, "id", "name"); return active.RenameFolder(Id(p, "id"), Text(p, "name"));
            case "folder.move":
                Keys(p, "id", "parentId"); return active.MoveFolder(Id(p, "id"), OptionalId(p, "parentId"));
            case "folder.duplicate":
                Keys(p, "id", "name", "parentId", "expectedRevision");
                var revision = p.GetProperty("expectedRevision").GetInt64();
                if (revision is < 0 or > 9_007_199_254_740_991) throw Invalid();
                return active.DuplicateFolder(Id(p, "id"), Text(p, "name"), OptionalId(p, "parentId"), revision);
            case "folder.delete":
                Keys(p, "id", "expectedRevision", "allowUpgrade");
                return active.DeleteFolder(Id(p, "id"), Revision(p), p.GetProperty("allowUpgrade").GetBoolean());
            case "folder.restore":
                Keys(p, "id", "name", "parentId", "expectedRevision");
                return active.RestoreFolder(Id(p, "id"), Text(p, "name"), OptionalId(p, "parentId"), Revision(p));
            case "script.classify":
                Keys(p, "id", "tags", "favourite", "expectedRevision", "allowUpgrade");
                var tags = p.GetProperty("tags").EnumerateArray().Select(tag => tag.GetString() ?? throw Invalid()).ToList();
                return active.ClassifyScript(Id(p, "id"), tags, p.GetProperty("favourite").GetBoolean(), Revision(p), p.GetProperty("allowUpgrade").GetBoolean());
            case "script.create":
                Keys(p, "name", "language", "folderId"); return active.CreateScript(Text(p, "name"), Text(p, "language"), OptionalId(p, "folderId"));
            case "script.read":
                Keys(p, "id"); return active.ReadScript(Id(p, "id"));
            case "script.duplicate":
                Keys(p, "id", "name", "folderId", "expectedHash");
                var duplicateHash = Text(p, "expectedHash");
                if (!WorkspaceStore.ValidHash(duplicateHash)) throw Invalid();
                return active.DuplicateScript(Id(p, "id"), Text(p, "name"), OptionalId(p, "folderId"), duplicateHash);
            case "script.delete":
                Keys(p, "id", "expectedHash", "expectedRevision", "allowUpgrade");
                var deleteHash = Text(p, "expectedHash");
                if (!WorkspaceStore.ValidHash(deleteHash)) throw Invalid();
                return active.DeleteScript(Id(p, "id"), deleteHash, Revision(p), p.GetProperty("allowUpgrade").GetBoolean());
            case "script.restore":
                Keys(p, "id", "name", "folderId", "expectedRevision");
                return active.RestoreScript(Id(p, "id"), Text(p, "name"), OptionalId(p, "folderId"), Revision(p));
            case "script.save":
                Keys(p, "id", "name", "language", "folderId", "content", "expectedHash");
                var hash = Text(p, "expectedHash");
                if (!WorkspaceStore.ValidHash(hash)) throw Invalid();
                return active.SaveScript(Id(p, "id"), Text(p, "name"), Text(p, "language"), OptionalId(p, "folderId"), Text(p, "content"), hash);
            default: throw Invalid();
        }
    }
    private static CollectionFilter Filter(JsonElement p)
    {
        var filter = p.GetProperty("filter");
        Keys(filter, "nameContains", "language", "folderId", "tag", "favouritesOnly");
        return new(Text(filter, "nameContains"), filter.GetProperty("language").ValueKind == JsonValueKind.Null ? null : Text(filter, "language"),
            OptionalId(filter, "folderId"), filter.GetProperty("tag").ValueKind == JsonValueKind.Null ? null : Text(filter, "tag"), filter.GetProperty("favouritesOnly").GetBoolean());
    }
    private static string? Token(JsonElement p)
    {
        if (p.GetProperty("expectedToken").ValueKind == JsonValueKind.Null) return null;
        var token = Text(p, "expectedToken");
        return WorkspaceStore.ValidHash(token) ? token : throw Invalid();
    }
    private static long Revision(JsonElement p)
    {
        var revision = p.GetProperty("expectedRevision").GetInt64();
        return revision is >= 0 and <= 9_007_199_254_740_991 ? revision : throw Invalid();
    }
    private static void Keys(JsonElement value, params string[] allowed)
    {
        var keys = value.EnumerateObject().Select(p => p.Name).ToList();
        if (keys.Count != allowed.Length || keys.Distinct().Count() != keys.Count || keys.Any(k => !allowed.Contains(k))) throw Invalid();
    }
    private static string Text(JsonElement value, string name) => value.GetProperty(name).GetString() ?? throw Invalid();
    private static Guid Id(JsonElement value, string name) => value.GetProperty(name).GetGuid() is var id && id != Guid.Empty ? id : throw Invalid();
    private static Guid? OptionalId(JsonElement value, string name) => value.GetProperty(name).ValueKind == JsonValueKind.Null ? null : Id(value, name);
    private static WorkspaceException Invalid() => new("invalid_request", "Unsupported or invalid workspace request.");
    public void Dispose() => workspace?.Dispose();
}
