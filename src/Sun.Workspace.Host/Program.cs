using System.Buffers.Binary;
using System.Text.Json;
using Sun.Workspace.Host;

// Local workspace operations only. Never execute script content in this process.
const int maxFrameBytes = 4 * 1024 * 1024;
using var workspace = new WorkspaceSession();
var responseJson = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
var input = Console.OpenStandardInput();
var output = Console.OpenStandardOutput();
var header = new byte[4];
try
{
    while (true)
    {
        var first = await input.ReadAsync(header.AsMemory(0, 1));
        if (first == 0) break;
        await input.ReadExactlyAsync(header.AsMemory(1));
        var size = BinaryPrimitives.ReadInt32BigEndian(header);
        if (size is <= 0 or > maxFrameBytes) return 2;
        var payload = new byte[size];
        await input.ReadExactlyAsync(payload);
        using var request = JsonDocument.Parse(payload);
        var root = request.RootElement;
        if (root.ValueKind != JsonValueKind.Object ||
            !root.TryGetProperty("version", out var version) || !version.TryGetInt32(out var v) || v != 1 ||
            !root.TryGetProperty("id", out var id) || id.ValueKind != JsonValueKind.String ||
            !Guid.TryParse(id.GetString(), out _) ||
            !root.TryGetProperty("method", out var method) || method.ValueKind != JsonValueKind.String)
            return 2;

        object? result = null;
        object? error = null;
        try { result = workspace.Execute(method.GetString()!, root); }
        catch (WorkspaceException exception) { error = new { code = exception.Code, message = exception.Message }; }
        catch (Exception exception) when (exception is JsonException or ArgumentException or InvalidOperationException or KeyNotFoundException or FormatException or OverflowException)
        { error = new { code = "invalid_request", message = "Invalid request or workspace manifest. No existing source was overwritten." }; }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        { error = new { code = "io_error", message = "Workspace file access failed. Check folder permissions and available disk space; your editor buffer was not discarded." }; }
        object response = new { version = 1, id = id.GetString(), result, error };
        var bytes = JsonSerializer.SerializeToUtf8Bytes(response, responseJson);
        BinaryPrimitives.WriteInt32BigEndian(header, bytes.Length);
        await output.WriteAsync(header);
        await output.WriteAsync(bytes);
        await output.FlushAsync();
    }
    return 0;
}
catch (Exception exception) when (exception is JsonException or EndOfStreamException or IOException or InvalidOperationException)
{
    await Console.Error.WriteLineAsync("Invalid or interrupted protocol stream.");
    return 2;
}
