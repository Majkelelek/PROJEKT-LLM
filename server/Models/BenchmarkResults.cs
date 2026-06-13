using System.Text.Json.Serialization;

namespace NeuroBench.Backend.Models
{
    public class BenchmarkResults
    {
        [JsonPropertyName("ollama")]
        public OllamaResult? Ollama { get; set; }
    }
}
