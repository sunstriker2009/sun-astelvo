using System.Text.Json;

namespace Sun.Workspace.Host;

internal sealed class WorkspaceSession : IDisposable
{
    private WorkspaceStore? workspace;
    public object? Execute(string method, JsonElement request)
    {
        if (method == "host.info") return new { product = "ASTELVO", protocol = 1, runtime = Environment.Version.ToString() };
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
        if (method == "workspace.close") { Keys(p); workspace?.Dispose(); workspace = null; return null; }
        var active = workspace ?? throw new WorkspaceException("no_workspace", "Create or open a workspace first.");
        switch (method)
        {
            case "folder.create":
                Keys(p, "name", "parentId"); return active.CreateFolder(Text(p, "name"), OptionalId(p, "parentId"));
            case "folder.rename":
                Keys(p, "id", "name"); return active.RenameFolder(Id(p, "id"), Text(p, "name"));
            case "script.create":
                Keys(p, "name", "language", "folderId"); return active.CreateScript(Text(p, "name"), Text(p, "language"), OptionalId(p, "folderId"));
            case "script.read":
                Keys(p, "id"); return active.ReadScript(Id(p, "id"));
            case "script.save":
                Keys(p, "id", "name", "language", "folderId", "content", "expectedHash");
                var hash = Text(p, "expectedHash");
                if (!WorkspaceStore.ValidHash(hash)) throw Invalid();
                return active.SaveScript(Id(p, "id"), Text(p, "name"), Text(p, "language"), OptionalId(p, "folderId"), Text(p, "content"), hash);
            default: throw Invalid();
        }
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
