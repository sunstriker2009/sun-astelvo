using System.Buffers.Binary;
using System.IO.Compression;

namespace Sun.Workspace.Host;

internal sealed partial class WorkspaceStore
{
    private const int MaxArchiveSourceBytes = 64 * 1024 * 1024;
    private const int MaxArchiveFileBytes = MaxArchiveSourceBytes + 2 * 1024 * 1024;
    private sealed record ArchiveSnapshot(Manifest Manifest, byte[] Metadata, List<(Script Script, byte[] Bytes)> Sources);
    private static IEnumerable<Script> ArchiveScripts(Manifest value) => value.Scripts.Concat(value.DeletedScripts ?? [])
        .Concat((value.DeletedFolderTrees ?? []).SelectMany(tree => tree.Scripts.Concat(tree.DeletedScripts)));
    private static string ArchiveSourceName(Script script) => $"scripts/{script.Id:D}/{script.SourceHash}{Extensions[script.Language]}";

    public object ExportArchive(string archivePath, long expectedRevision)
    {
        CheckRevision(expectedRevision);
        var target = Path.GetFullPath(archivePath);
        PlainPath(target);
        var relative = Path.GetRelativePath(Root, target);
        if (!Path.IsPathRooted(relative) && relative != ".." && !relative.StartsWith(".." + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            throw Error("invalid_request", "Export to a new archive outside the active workspace.");
        if (!Directory.Exists(Path.GetDirectoryName(target)) || File.Exists(target) || Directory.Exists(target))
            throw Error("conflict", "Choose a new archive filename in an existing folder. Existing files are never replaced.");
        var metadata = ReadBytes(ManifestPath, MaxManifestBytes);
        if (Hash(metadata) != manifestHash) throw Error("conflict", "Workspace metadata changed before export.");
        var temp = target + "." + Guid.NewGuid().ToString("N") + ".tmp";
        var count = 0; var total = 0;
        try
        {
            using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None))
            {
                using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, true))
                {
                    using (var entry = zip.CreateEntry("workspace.json", CompressionLevel.Fastest).Open()) entry.Write(metadata);
                    foreach (var script in ArchiveScripts(manifest))
                    {
                        var bytes = ReadBytes(SourcePath(script), MaxSourceBytes);
                        VerifyArchiveSource(script, bytes);
                        total += bytes.Length;
                        if (total > MaxArchiveSourceBytes) throw ArchiveLimit();
                        using var entry = zip.CreateEntry(ArchiveSourceName(script), CompressionLevel.Fastest).Open();
                        entry.Write(bytes); count++;
                    }
                }
                stream.Flush(true);
            }
            // Verify the completed artifact before giving it its final name.
            var verified = ReadArchive(temp);
            if (!verified.Metadata.AsSpan().SequenceEqual(metadata)) throw InvalidArchive();
            foreach (var script in ArchiveScripts(manifest)) VerifyArchiveSource(script, ReadBytes(SourcePath(script), MaxSourceBytes));
            CheckManifest(); PlainPath(target);
            File.Move(temp, target, false);
            return new { archivePath = target, workspaceId = manifest.Id, revision = manifest.Revision, schemaVersion = manifest.SchemaVersion, scriptCount = count, sourceBytes = total };
        }
        finally { if (File.Exists(temp)) File.Delete(temp); }
    }

    public static WorkspaceStore RestoreArchive(string archivePath, string directory)
    {
        // Complete preflight, including hashes/UTF-8, before creating managed files.
        var snapshot = ReadArchive(Path.GetFullPath(archivePath));
        var root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(directory));
        if (OperatingSystem.IsWindows() && root.StartsWith(@"\\", StringComparison.Ordinal))
            throw Error("invalid_workspace", "Use a local folder; network workspaces are not supported in this preview.");
        PlainPath(root);
        if (!Directory.Exists(root)) throw Error("invalid_workspace", "Restore into an existing empty local folder.");
        var lockPath = Path.Combine(root, ".astelvo-writer.lock"); PlainPath(lockPath);
        if (Directory.EnumerateFileSystemEntries(root).Any(path => path != lockPath))
            throw Error("invalid_workspace", "Restore requires an empty folder. Existing files were not changed.");
        FileStream lease;
        try { lease = new FileStream(lockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None); }
        catch (IOException) { throw Error("locked", "The restore folder is open in another instance, or its lock is unavailable."); }
        try
        {
            if (Directory.EnumerateFileSystemEntries(root).Any(path => path != lockPath))
                throw Error("invalid_workspace", "Restore requires an empty folder. Existing files were not changed.");
            var store = new WorkspaceStore(root, lease, snapshot.Manifest, Hash(snapshot.Metadata));
            Directory.CreateDirectory(Path.Combine(root, "scripts"));
            foreach (var (script, bytes) in snapshot.Sources) store.WriteRevision(script, bytes);
            foreach (var (script, _) in snapshot.Sources) VerifyArchiveSource(script, ReadBytes(store.SourcePath(script), MaxSourceBytes));
            // The exact original manifest is the final visibility/commit point.
            AtomicWrite(Path.Combine(root, "workspace.json"), snapshot.Metadata, false);
            return store;
        }
        catch { lease.Dispose(); throw; }
    }

    private static ArchiveSnapshot ReadArchive(string path)
    {
        PlainPath(path);
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        if (stream.Length > MaxArchiveFileBytes) throw ArchiveLimit();
        var checksums = CheckZipEnvelope(stream);
        using var zip = new ZipArchive(stream, ZipArchiveMode.Read);
        if (zip.Entries.Count > 1001) throw InvalidArchive();
        var entries = new Dictionary<string, ZipArchiveEntry>(StringComparer.OrdinalIgnoreCase);
        foreach (var entry in zip.Entries)
        {
            var mode = (entry.ExternalAttributes >> 16) & 0xf000;
            if (entry.FullName.EndsWith('/') || mode is not (0 or 0x8000) || (entry.ExternalAttributes & (int)FileAttributes.ReparsePoint) != 0
                || !entries.TryAdd(entry.FullName, entry)) throw InvalidArchive();
        }
        if (!entries.TryGetValue("workspace.json", out var manifestEntry) || manifestEntry.FullName != "workspace.json") throw InvalidArchive();
        var metadata = ReadEntry(manifestEntry, MaxManifestBytes); VerifyEntryChecksum(manifestEntry, metadata, checksums);
        var value = ParseManifest(metadata); Validate(value);
        var expected = ArchiveScripts(value).ToList();
        if (entries.Count != expected.Count + 1) throw InvalidArchive();
        var sources = new List<(Script, byte[])>(); var total = 0;
        foreach (var script in expected)
        {
            var name = ArchiveSourceName(script);
            if (!entries.TryGetValue(name, out var entry) || entry.FullName != name) throw InvalidArchive();
            if (entry.Length > MaxSourceBytes || total + entry.Length > MaxArchiveSourceBytes) throw ArchiveLimit();
            var bytes = ReadEntry(entry, MaxSourceBytes); VerifyEntryChecksum(entry, bytes, checksums); VerifyArchiveSource(script, bytes);
            total += bytes.Length; sources.Add((script, bytes));
        }
        return new(value, metadata, sources);
    }

    private static byte[] ReadEntry(ZipArchiveEntry entry, int limit)
    {
        if (entry.Length < 0 || entry.Length > limit) throw ArchiveLimit();
        var bytes = new byte[checked((int)entry.Length)];
        using var input = entry.Open(); input.ReadExactly(bytes);
        if (input.ReadByte() != -1) throw InvalidArchive();
        return bytes;
    }

    private static void VerifyArchiveSource(Script script, byte[] bytes)
    {
        if (Hash(bytes) != script.SourceHash) throw Error("conflict", "A source differs from its committed hash. Review/recover it before exporting or restoring; no source was overwritten.");
        _ = Utf8.GetString(bytes);
    }

    // Reject oversized/ZIP64/multi-disk/encrypted/unsupported envelopes and bound
    // the central directory before ZipArchive materializes its entry objects.
    private static Dictionary<string, uint> CheckZipEnvelope(FileStream stream)
    {
        if (stream.Length < 22) throw InvalidArchive();
        var tail = new byte[(int)Math.Min(65557, stream.Length)];
        stream.Position = stream.Length - tail.Length; stream.ReadExactly(tail);
        var end = -1;
        for (var i = tail.Length - 22; i >= 0; i--)
            if (BinaryPrimitives.ReadUInt32LittleEndian(tail.AsSpan(i)) == 0x06054b50
                && i + 22 + BinaryPrimitives.ReadUInt16LittleEndian(tail.AsSpan(i + 20)) == tail.Length) { end = i; break; }
        if (end < 0) throw InvalidArchive();
        var eocd = tail.AsSpan(end);
        var count = BinaryPrimitives.ReadUInt16LittleEndian(eocd[10..]);
        var size = BinaryPrimitives.ReadUInt32LittleEndian(eocd[12..]);
        var offset = BinaryPrimitives.ReadUInt32LittleEndian(eocd[16..]);
        if (BinaryPrimitives.ReadUInt16LittleEndian(eocd[4..]) != 0 || BinaryPrimitives.ReadUInt16LittleEndian(eocd[6..]) != 0
            || BinaryPrimitives.ReadUInt16LittleEndian(eocd[8..]) != count || count > 1001 || size > 1024 * 1024
            || (long)offset + size != stream.Length - tail.Length + end) throw InvalidArchive();
        stream.Position = offset; var header = new byte[46]; var consumed = 0L;
        var checksums = new Dictionary<string, uint>(StringComparer.Ordinal);
        for (var i = 0; i < count; i++)
        {
            if (consumed + header.Length > size) throw InvalidArchive();
            stream.ReadExactly(header);
            var method = BinaryPrimitives.ReadUInt16LittleEndian(header.AsSpan(10));
            if (BinaryPrimitives.ReadUInt32LittleEndian(header) != 0x02014b50 || (BinaryPrimitives.ReadUInt16LittleEndian(header.AsSpan(8)) & 1) != 0
                || method is not (0 or 8) || BinaryPrimitives.ReadUInt16LittleEndian(header.AsSpan(34)) != 0
                || BinaryPrimitives.ReadUInt32LittleEndian(header.AsSpan(20)) == uint.MaxValue || BinaryPrimitives.ReadUInt32LittleEndian(header.AsSpan(24)) == uint.MaxValue) throw InvalidArchive();
            var variable = BinaryPrimitives.ReadUInt16LittleEndian(header.AsSpan(28)) + BinaryPrimitives.ReadUInt16LittleEndian(header.AsSpan(30)) + BinaryPrimitives.ReadUInt16LittleEndian(header.AsSpan(32));
            consumed += header.Length + variable;
            if (consumed > size) throw InvalidArchive();
            var nameLength = BinaryPrimitives.ReadUInt16LittleEndian(header.AsSpan(28));
            var name = new byte[nameLength]; stream.ReadExactly(name);
            if (!checksums.TryAdd(Utf8.GetString(name), BinaryPrimitives.ReadUInt32LittleEndian(header.AsSpan(16)))) throw InvalidArchive();
            stream.Position += variable - nameLength;
        }
        if (consumed != size) throw InvalidArchive();
        stream.Position = 0;
        return checksums;
    }

    private static readonly uint[] ArchiveCrcTable = Enumerable.Range(0, 256).Select(value =>
    {
        var crc = (uint)value;
        for (var i = 0; i < 8; i++) crc = (crc >> 1) ^ (0xedb88320u & (uint)-(int)(crc & 1));
        return crc;
    }).ToArray();

    private static void VerifyEntryChecksum(ZipArchiveEntry entry, byte[] bytes, Dictionary<string, uint> checksums)
    {
        var crc = uint.MaxValue;
        foreach (var value in bytes) crc = (crc >> 8) ^ ArchiveCrcTable[(crc ^ value) & 255];
        if (!checksums.TryGetValue(entry.FullName, out var expected) || ~crc != expected) throw InvalidArchive();
    }

    private static WorkspaceException InvalidArchive() => new("invalid_archive", "Unsupported or invalid workspace archive. Use an WORKBENCH export with exact manifest/source entries; directories, links, extra paths, duplicates, ZIP64 and encrypted archives are rejected.");
    private static WorkspaceException ArchiveLimit() => new("limit_exceeded", "Workspace archive limit: 64 MiB referenced source, 1 MiB manifest, 1,001 entries and 66 MiB archive file. No partial archive was published.");
}
