using System.Text.Json.Serialization;

namespace ProjektAI.Backend.Models
{
    // Informacje o lokalnie zainstalowanym modelu pobrane z usługi Ollama.
    public class OllamaModelInfo
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("parameter_size")]
        public string ParameterSize { get; set; } = string.Empty;

        [JsonPropertyName("quantization_level")]
        public string QuantizationLevel { get; set; } = string.Empty;

        [JsonPropertyName("family")]
        public string Family { get; set; } = string.Empty;
    }
}
