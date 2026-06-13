using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace NeuroBench.Backend.Models
{
    public class RunBenchmarkRequest
    {
        [JsonPropertyName("model")]
        public string? Model { get; set; }

        [JsonPropertyName("tests")]
        public List<string> Tests { get; set; } = new() { "ollama" };

        [JsonPropertyName("complexity")]
        public string Complexity { get; set; } = "medium";
    }
}
