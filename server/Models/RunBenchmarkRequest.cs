using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace ProjektAI.Backend.Models
{
    // Model reprezentujący żądanie uruchomienia nowego testu (Run Benchmark Request).
    public class RunBenchmarkRequest
    {
        // Nazwa wybranego modelu LLM do przeprowadzenia testu
        [JsonPropertyName("model")]
        public string? Model { get; set; }

        // Lista rodzajów testów (domyślnie "ollama")
        [JsonPropertyName("tests")]
        public List<string> Tests { get; set; } = new() { "ollama" };

        // Złożoność testu (np. "quick" - szybki, "medium" - średni, "complex" - złożony)
        [JsonPropertyName("complexity")]
        public string Complexity { get; set; } = "medium";
    }
}
