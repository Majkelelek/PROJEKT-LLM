using System.Text.Json.Serialization;

namespace ProjektAI.Backend.Models
{
    // Model przechowujący wyniki benchmarków (na ten moment zawiera wyniki testów Ollamy).
    public class BenchmarkResults
    {
        // Wyniki testów wydajnościowych wnioskowania lokalnego modelu LLM
        [JsonPropertyName("ollama")]
        public OllamaResult? Ollama { get; set; }
    }
}
