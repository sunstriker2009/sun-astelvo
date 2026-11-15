using System.Text.RegularExpressions;

namespace Sun.Workspace.Host;

// Rebuildable session cache. Portable manifests/source revisions remain authoritative.
internal sealed class SourceSearchIndex
{
    public const int MaxIndexedBytes = 32 * 1024 * 1024;
    private const int MaxTerms = 100_000;
    private const int MaxPostings = 500_000;
    private static readonly Regex Words = new(@"[\p{L}\p{M}\p{N}_]+", RegexOptions.CultureInvariant | RegexOptions.NonBacktracking);
    private readonly Dictionary<string, HashSet<Guid>> postings = new(StringComparer.Ordinal);
    private int postingCount;
    public int IndexedCount { get; private set; }
    public int IndexedBytes { get; private set; }

    public static string[] QueryTerms(string query)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Length > 120 || query.Any(char.IsControl)) throw InvalidQuery();
        var matches = Words.Matches(query).Cast<Match>().ToList();
        if (matches.Count == 0 || matches.Count > 8 || matches.Any(m => m.Length > 64)) throw InvalidQuery();
        return matches.Select(m => m.Value.ToUpperInvariant()).Distinct(StringComparer.Ordinal).ToArray();
    }

    public void Add(Guid id, string content, int byteCount)
    {
        if (IndexedBytes + byteCount > MaxIndexedBytes) throw Limit();
        foreach (var term in Words.Matches(content).Cast<Match>().Where(m => m.Length <= 64).Select(m => m.Value.ToUpperInvariant()).Distinct(StringComparer.Ordinal))
        {
            if (!postings.TryGetValue(term, out var documents))
            {
                if (postings.Count >= MaxTerms) throw Limit();
                postings.Add(term, documents = []);
            }
            if (documents.Add(id) && ++postingCount > MaxPostings) throw Limit();
        }
        IndexedCount++; IndexedBytes += byteCount;
    }

    public Guid[] Search(string[] terms)
    {
        var sets = terms.Select(term => postings.GetValueOrDefault(term)).ToList();
        if (sets.Any(set => set == null)) return [];
        sets.Sort((a, b) => a!.Count.CompareTo(b!.Count));
        var result = new HashSet<Guid>(sets[0]!);
        foreach (var set in sets.Skip(1)) result.IntersectWith(set!);
        return result.Order().ToArray();
    }

    private static WorkspaceException InvalidQuery() => new("invalid_request", "Use 1–8 source words, at most 64 characters per word and 120 characters total. Source search matches whole words with AND; operators and phrases are not supported.");
    private static WorkspaceException Limit() => new("limit_exceeded", "Source index limit exceeded: 32 MiB of active source, 100,000 distinct words or 500,000 word/script pairs. Editing remains available; no partial search results were published.");
}
