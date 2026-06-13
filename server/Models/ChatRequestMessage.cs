using System.Text.Json.Serialization;

namespace NeuroBench.Backend.Models
{
    public class ChatRequestMessage
    {
        [JsonPropertyName("role")]
        public string Role { get; set; } = string.Empty;

        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;
    }
}
