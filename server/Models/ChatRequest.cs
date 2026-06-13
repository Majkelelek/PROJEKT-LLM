using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace ProjektAI.Backend.Models
{
    // Model reprezentujący żądanie wysyłane do czatu eksperckiego (Chat Request).
    public class ChatRequest
    {
        // Nazwa modelu LLM wybranego do obsługi czatu
        [JsonPropertyName("model")]
        public string Model { get; set; } = string.Empty;

        // Aktualna specyfikacja systemu dołączana jako kontekst dla AI
        [JsonPropertyName("specs")]
        public SystemSpecs Specs { get; set; } = new();

        // Ostatnio uzyskane wyniki testów dołączane jako kontekst dla AI
        [JsonPropertyName("results")]
        public BenchmarkResults Results { get; set; } = new();

        // Historia dotychczasowej konwersacji (lista wiadomości)
        [JsonPropertyName("history")]
        public List<ChatRequestMessage> History { get; set; } = new();
    }
}
