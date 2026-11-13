using System.Buffers.Binary;
using System.Text.Json;

// M0 exposes only host information. Never execute script content in this process.
const int maxFrameBytes = 4096;
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

        object response = method.GetString() == "host.info"
            ? new { version = 1, id = id.GetString(), result = new { product = "ASTELVO", protocol = 1, runtime = Environment.Version.ToString() }, error = (string?)null }
            : (object)new { version = 1, id = id.GetString(), result = (object?)null, error = "Unsupported method" };
        var bytes = JsonSerializer.SerializeToUtf8Bytes(response);
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
