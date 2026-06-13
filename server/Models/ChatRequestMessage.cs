using System.Text.Json.Serialization;

namespace ProjektAI.Backend.Models
{
    // Model reprezentujący pojedynczą wiadomość w historii czatu.
    public class ChatRequestMessage
    {
        // Rola nadawcy wiadomości (np. "user" - użytkownik, "assistant" - asystent AI)
        [JsonPropertyName("role")]
        public string Role { get; set; } = string.Empty;

        // Treść wiadomości tekstowej
        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;
    }
}
