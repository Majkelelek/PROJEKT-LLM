using System.Text.Json.Serialization;

namespace ProjektAI.Backend.Models
{
    // Model reprezentujący pełny przebieg pojedynczego testu wydajnościowego (Benchmark Run).
    public class BenchmarkRun
    {
        // Unikalny identyfikator testu (GUID)
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        // Data i czas wykonania testu w formacie ISO
        [JsonPropertyName("timestamp")]
        public string Timestamp { get; set; } = string.Empty;

        // Specyfikacja sprzętowa zarejestrowana podczas tego testu
        [JsonPropertyName("specs")]
        public SystemSpecs? Specs { get; set; }

        // Zarejestrowane wyniki wydajności (czas, tokeny na sekundę itp.)
        [JsonPropertyName("results")]
        public BenchmarkResults? Results { get; set; }

        // Raport analityczny wygenerowany przez AI na podstawie powyższych danych
        [JsonPropertyName("ai_report")]
        public string AiReport { get; set; } = string.Empty;

        // Nazwa lokalnego modelu językowego wybranego do tego testu
        [JsonPropertyName("selected_model")]
        public string SelectedModel { get; set; } = string.Empty;

        // Wybrany poziom złożoności testu (np. quick, medium, complex)
        [JsonPropertyName("complexity")]
        public string Complexity { get; set; } = "medium";
    }
}
