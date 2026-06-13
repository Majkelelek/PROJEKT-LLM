using System.Text.Json.Serialization;

namespace NeuroBench.Backend.Models
{
    public class GpuDetail
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = "Unknown GPU";

        [JsonPropertyName("vram_gb")]
        public double VramGb { get; set; }
    }
}
