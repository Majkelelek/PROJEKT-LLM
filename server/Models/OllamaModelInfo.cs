using System.Text.Json.Serialization;

namespace ProjektAI.Backend.Models
{
    // Informacje o lokalnie zainstalowanym modelu pobrane z usługi Ollama.
    public class OllamaModelInfo
    {
        // Nazwa modelu pobrana z silnika Ollama (np. "llama3.2:1b")
        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        // Rozmiar parametrów modelu w postaci tekstowej (np. "1.5B" lub "8.0B")
        [JsonPropertyName("parameter_size")]
        public string ParameterSize { get; set; } = string.Empty;

        // Stopień kwantyzacji/kompresji modelu (np. "Q4_K_M" lub "FP16")
        [JsonPropertyName("quantization_level")]
        public string QuantizationLevel { get; set; } = string.Empty;

        // Rodzina architektoniczna modelu (np. "llama", "phi" itp.)
        [JsonPropertyName("family")]
        public string Family { get; set; } = string.Empty;
    }
}
