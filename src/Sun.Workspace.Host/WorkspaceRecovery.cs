using System.Text.Json;

namespace Sun.Workspace.Host;

internal sealed record RecoveryDocument(Guid Id, string Name, string Language, Guid? FolderId, string Content, string Hash, bool ExternalChanged, Classification Classification);
internal sealed record RecoveryDraft(string Name, string Language, Guid? FolderId);
internal sealed record RecoveryTab(RecoveryDocument Saved, RecoveryDraft Draft, string Content, string TagText, bool Favourite);
internal sealed record RecoverySnapshot(string Format, int Version, Guid WorkspaceId, List<RecoveryTab> Tabs);

internal sealed partial class WorkspaceStore
{
    private const int MaxRecoveryBytes = 3 * 1024 * 1024;
    private string RecoveryPath => Path.Combine(Root, ".astelvo-recovery.json");

    public object ReadRecovery()
    {
        CheckManifest();
        var bytes = RecoveryBytes();
        if (bytes == null) return new { workspaceId = manifest.Id, token = (string?)null, snapshot = (RecoverySnapshot?)null, problem = (string?)null };
        RecoverySnapshot? snapshot = null;
        string? problem = null;
        try { snapshot = ParseRecovery(bytes); }
        catch (Exception error) when (error is JsonException or ArgumentException or WorkspaceException or InvalidOperationException)
        { problem = "The checkpoint is invalid or belongs to another workspace. It was preserved; discard it explicitly or keep the file for inspection."; }
        return new { workspaceId = manifest.Id, token = Hash(bytes), snapshot, problem };
    }

    public object WriteRecovery(string? expectedToken, JsonElement value)
    {
        CheckManifest();
        var bytes = JsonSerializer.SerializeToUtf8Bytes(value, Json);
        if (bytes.Length > MaxRecoveryBytes) throw Error("limit_exceeded", "Draft checkpoint exceeds 3 MiB. Existing recovery data was preserved.");
        var snapshot = ParseRecovery(bytes);
        if (snapshot.Tabs.Any(tab => !manifest.Scripts.Any(script => script.Id == tab.Saved.Id)))
            throw Error("not_found", "A checkpoint script is no longer active. Existing recovery data was preserved.");
        CheckRecoveryToken(expectedToken);
        CheckManifest();
        AtomicWrite(RecoveryPath, bytes, true);
        return new { workspaceId = manifest.Id, token = Hash(bytes) };
    }

    public object ClearRecovery(string? expectedToken)
    {
        CheckManifest(); CheckRecoveryToken(expectedToken);
        // Only the fixed checkpoint file is removed, never source or metadata.
        File.Delete(RecoveryPath);
        return new { workspaceId = manifest.Id, token = (string?)null };
    }

    private byte[]? RecoveryBytes()
    {
        PlainPath(RecoveryPath);
        return File.Exists(RecoveryPath) ? ReadBytes(RecoveryPath, MaxRecoveryBytes) : null;
    }

    private void CheckRecoveryToken(string? expected)
    {
        var bytes = RecoveryBytes();
        if ((bytes == null ? null : Hash(bytes)) != expected)
            throw Error("conflict", "Recovery checkpoint changed. Read it again before replacing or discarding it.");
    }

    private RecoverySnapshot ParseRecovery(byte[] bytes)
    {
        using var document = JsonDocument.Parse(bytes);
        static void Unique(JsonElement value)
        {
            if (value.ValueKind == JsonValueKind.Object)
            {
                var names = new HashSet<string>(StringComparer.Ordinal);
                foreach (var property in value.EnumerateObject())
                {
                    if (!names.Add(property.Name)) throw Error("invalid_request", "Duplicate checkpoint property.");
                    Unique(property.Value);
                }
            }
            else if (value.ValueKind == JsonValueKind.Array) foreach (var item in value.EnumerateArray()) Unique(item);
        }
        Unique(document.RootElement);
        var snapshot = JsonSerializer.Deserialize<RecoverySnapshot>(bytes, Json) ?? throw Error("invalid_request", "Invalid checkpoint.");
        if (snapshot.Format != "astelvo-draft-checkpoint" || snapshot.Version != 1 || snapshot.WorkspaceId != manifest.Id
            || snapshot.Tabs == null || snapshot.Tabs.Count is < 1 or > 16)
            throw Error("invalid_request", "Unsupported checkpoint identity, version or tab count.");
        var ids = new HashSet<Guid>();
        foreach (var tab in snapshot.Tabs)
        {
            if (tab?.Saved == null || tab.Draft == null || !ids.Add(tab.Saved.Id) || tab.Saved.Id == Guid.Empty
                || tab.Saved.FolderId == Guid.Empty || tab.Draft.FolderId == Guid.Empty)
                throw Error("invalid_request", "Invalid checkpoint tab identity.");
            _ = Name(tab.Saved.Name); _ = Language(tab.Saved.Language); _ = Language(tab.Draft.Language);
            if (tab.Draft.Name == null || tab.Draft.Name.Length > 120 || tab.TagText == null || tab.TagText.Length > 656
                || tab.Saved.Content == null || tab.Content == null || Utf8.GetByteCount(tab.Saved.Content) > MaxSourceBytes || Utf8.GetByteCount(tab.Content) > MaxSourceBytes
                || !ValidHash(tab.Saved.Hash) || Hash(Utf8.GetBytes(tab.Saved.Content)) != tab.Saved.Hash)
                throw Error("invalid_request", "Invalid checkpoint draft or base content/hash.");
            if (tab.Saved.Classification == null) throw Error("invalid_request", "Missing checkpoint classification.");
            ValidateClassification(tab.Saved.Classification);
        }
        // External JSON may use compact/unescaped strings. Bound the typed
        // representation too, so returning it can never exceed the IPC frame.
        if (JsonSerializer.SerializeToUtf8Bytes(snapshot, Json).Length > MaxRecoveryBytes)
            throw Error("limit_exceeded", "Encoded checkpoint exceeds the recovery response limit.");
        return snapshot;
    }
}
