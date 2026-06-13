using System.Text.Json.Serialization;

namespace NeuroBench.Backend.Models
{
    public class OllamaResult
    {
        [JsonPropertyName("model")]
        public string Model { get; set; } = string.Empty;

        [JsonPropertyName("response")]
        public string Response { get; set; } = string.Empty;

        [JsonPropertyName("total_time_sec")]
        public double TotalTimeSec { get; set; }

        [JsonPropertyName("latency_sec")]
        public double LatencySec { get; set; }

        [JsonPropertyName("tokens_per_sec")]
        public double TokensPerSec { get; set; }

        [JsonPropertyName("prompt_eval_tokens_per_sec")]
        public double PromptEvalTokensPerSec { get; set; }

        [JsonPropertyName("tokens_generated")]
        public int TokensGenerated { get; set; }

        [JsonPropertyName("error")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? Error { get; set; }
    }
}
