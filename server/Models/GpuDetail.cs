using System.Text.Json.Serialization;

namespace ProjektAI.Backend.Models
{
    // Szczegółowe parametry pojedynczej wykrytej karty graficznej (GPU).
    public class GpuDetail
    {
        // Pełna nazwa rynkowa karty graficznej
        [JsonPropertyName("name")]
        public string Name { get; set; } = "Nieznana karta GPU";

        // Rozmiar dedykowanej pamięci wideo karty graficznej (w gigabajtach, GB)
        [JsonPropertyName("vram_gb")]
        public double VramGb { get; set; }
    }
}
