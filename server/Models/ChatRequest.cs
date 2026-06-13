using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace NeuroBench.Backend.Models
{
    public class ChatRequest
    {
        [JsonPropertyName("model")]
        public string Model { get; set; } = string.Empty;

        [JsonPropertyName("specs")]
        public SystemSpecs Specs { get; set; } = new();

        [JsonPropertyName("results")]
        public BenchmarkResults Results { get; set; } = new();

        [JsonPropertyName("history")]
        public List<ChatRequestMessage> History { get; set; } = new();
    }
}
