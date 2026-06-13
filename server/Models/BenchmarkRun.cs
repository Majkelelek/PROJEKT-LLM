using System.Text.Json.Serialization;

namespace NeuroBench.Backend.Models
{
    public class BenchmarkRun
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("timestamp")]
        public string Timestamp { get; set; } = string.Empty;

        [JsonPropertyName("specs")]
        public SystemSpecs? Specs { get; set; }

        [JsonPropertyName("results")]
        public BenchmarkResults? Results { get; set; }

        [JsonPropertyName("ai_report")]
        public string AiReport { get; set; } = string.Empty;

        [JsonPropertyName("selected_model")]
        public string SelectedModel { get; set; } = string.Empty;

        [JsonPropertyName("complexity")]
        public string Complexity { get; set; } = "medium";
    }
}
