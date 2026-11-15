namespace Sun.Workspace.Host;

internal sealed partial class WorkspaceStore
{
    public object ImportScripts(List<string> paths, Guid? folderId, long expectedRevision, bool renameConflicts)
    {
        CheckRevision(expectedRevision);
        if (paths.Count is < 1 or > 32) throw Error("limit_exceeded", "Select 1–32 JavaScript, Python or C# source files per import.");
        if (folderId != null && !manifest.Folders.Any(folder => folder.Id == folderId)) throw Error("invalid_request", "Choose an active destination folder.");
        var seenPaths = new HashSet<string>(OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal);
        var names = manifest.Scripts.Where(script => script.FolderId == folderId).Select(script => script.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var staged = new List<(string Path, Script Script, byte[] Bytes)>(); var renamed = 0;
        foreach (var selected in paths)
        {
            if (string.IsNullOrWhiteSpace(selected) || selected.Length > 4096) throw Error("invalid_request", "Invalid selected source path.");
            var path = Path.GetFullPath(selected);
            if (OperatingSystem.IsWindows() && path.StartsWith(@"\\", StringComparison.Ordinal)) throw Error("invalid_request", "Import local source files; network paths are not supported in this preview.");
            if (!seenPaths.Add(path)) throw Error("invalid_request", "A source file was selected more than once.");
            var extension = Path.GetExtension(path);
            var language = Extensions.FirstOrDefault(pair => string.Equals(pair.Value, extension, StringComparison.OrdinalIgnoreCase)).Key
                ?? throw Error("invalid_request", "Only .js, .py and .cs source files can be imported.");
            var originalName = Name(Path.GetFileNameWithoutExtension(path));
            var name = originalName;
            if (!names.Add(name))
            {
                if (!renameConflicts) throw Error("conflict", "An imported name conflicts with an existing script or another selected file. Enable numbered copies or rename the source; no scripts were replaced.");
                for (var number = 2; ; number++)
                {
                    var suffix = $" ({number})";
                    var length = Math.Min(originalName.Length, 120 - suffix.Length);
                    if (length > 0 && char.IsHighSurrogate(originalName[length - 1])) length--;
                    name = originalName[..length] + suffix;
                    if (names.Add(name)) break;
                }
                renamed++;
            }
            var bytes = ReadBytes(path, MaxSourceBytes); _ = Utf8.GetString(bytes);
            var script = new Script(Guid.NewGuid(), name, language, folderId, Hash(bytes))
            {
                Classification = manifest.SchemaVersion >= 4 ? new([], false) : null
            };
            staged.Add((path, script, bytes));
        }
        // At most 32 x 256 KiB = 8 MiB is retained. Validate all metadata and
        // next-revision limits before creating any managed source revision.
        var next = manifest with { Scripts = [.. manifest.Scripts, .. staged.Select(item => item.Script)] };
        PreflightCommit(next); CheckManifest();
        foreach (var item in staged) WriteRevision(item.Script, item.Bytes);
        foreach (var item in staged)
        {
            if (Hash(ReadBytes(item.Path, MaxSourceBytes)) != item.Script.SourceHash)
                throw Error("conflict", "A selected source changed during import. Original files and prior metadata were retained; staged copies may remain unreferenced.");
            if (Hash(ReadBytes(SourcePath(item.Script), MaxSourceBytes)) != item.Script.SourceHash)
                throw Error("conflict", "A staged import source changed before commit. No partial import was published.");
        }
        Commit(next);
        return new { workspace = Snapshot(), importedIds = staged.Select(item => item.Script.Id).ToArray(), renamedCount = renamed };
    }
}
