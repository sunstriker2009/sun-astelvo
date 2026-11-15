using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Formatting;
using Microsoft.CodeAnalysis.Text;

namespace Sun.Workspace.Host;

internal static class CSharpFormatting
{
    private static readonly UTF8Encoding Utf8 = new(false, true);
    public static object Execute(string method, JsonElement request)
    {
        if (method != "format.csharp" || !request.TryGetProperty("params", out var p) || p.ValueKind != JsonValueKind.Object
            || p.EnumerateObject().Count() != 2 || !p.TryGetProperty("content", out var value) || !p.TryGetProperty("cursorOffset", out var cursor)
            || value.ValueKind != JsonValueKind.String || !cursor.TryGetInt32(out var position))
            throw new WorkspaceException("invalid_request", "Invalid C# formatting request.");
        var content = value.GetString()!;
        if (position < 0 || position > content.Length || Utf8.GetByteCount(content) > WorkspaceStore.MaxSourceBytes)
            throw new WorkspaceException("invalid_request", "Formatting requires a valid cursor and at most 256 KiB of UTF-8 source.");
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var token = deadline.Token;
        var bom = content.StartsWith('\ufeff');
        var body = bom ? content[1..] : content;
        var source = SourceText.From(body, Utf8);
        var tree = CSharpSyntaxTree.ParseText(source, new CSharpParseOptions(LanguageVersion.CSharp14, kind: SourceCodeKind.Regular), cancellationToken: token);
        var diagnostic = tree.GetDiagnostics(token).FirstOrDefault(d => d.Severity == DiagnosticSeverity.Error);
        if (diagnostic != null)
        {
            var line = diagnostic.Location.GetLineSpan().StartLinePosition;
            var message = $"C# syntax error at {line.Line + 1}:{line.Character + 1}: {diagnostic.GetMessage(CultureInfo.InvariantCulture)}";
            throw new WorkspaceException("syntax_error", message.Length > 400 ? message[..400] : message);
        }
        using var workspace = new AdhocWorkspace();
        var newline = body.Contains('\n') ? body.AsSpan(0, body.IndexOf('\n')).EndsWith("\r") ? "\r\n" : "\n" : body.Contains('\r') ? "\r" : "\n";
        var options = workspace.Options.WithChangedOption(FormattingOptions.UseTabs, LanguageNames.CSharp, false)
            .WithChangedOption(FormattingOptions.TabSize, LanguageNames.CSharp, 4)
            .WithChangedOption(FormattingOptions.IndentationSize, LanguageNames.CSharp, 4)
            .WithChangedOption(FormattingOptions.NewLine, LanguageNames.CSharp, newline);
        var changes = Formatter.GetFormattedTextChanges(tree.GetRoot(token), workspace, options, token).OrderBy(change => change.Span.Start).ToList();
        var formatted = (bom ? "\ufeff" : "") + source.WithChanges(changes).ToString();
        if (Utf8.GetByteCount(formatted) > WorkspaceStore.MaxSourceBytes)
            throw new WorkspaceException("limit_exceeded", "Formatted output exceeds the 256 KiB source limit. Original buffer retained.");
        var originalPosition = Math.Max(0, position - (bom ? 1 : 0));
        var mapped = originalPosition; var delta = 0;
        foreach (var change in changes)
        {
            var length = change.NewText?.Length ?? 0;
            if (originalPosition >= change.Span.End) { delta += length - change.Span.Length; mapped = originalPosition + delta; }
            else if (originalPosition >= change.Span.Start) { mapped = change.Span.Start + delta + Math.Min(originalPosition - change.Span.Start, length); break; }
            else break;
        }
        mapped = bom && position == 0 ? 0 : mapped + (bom ? 1 : 0);
        return new { formatted, cursorOffset = Math.Clamp(mapped, 0, formatted.Length) };
    }
}
