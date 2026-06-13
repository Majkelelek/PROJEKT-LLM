using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace ProjektAI.Backend.Models
{
    // Dynamiczne metryki obciążenia systemu pobierane na żywo w tle (Live Metrics).
    public class LiveMetrics
    {
        // Całkowity stopień zużycia procesora (w procentach, %)
        [JsonPropertyName("cpu_percent")]
        public double CpuPercent { get; set; }

        // Stopień zużycia poszczególnych rdzeni/wątków logicznych procesora (%)
        [JsonPropertyName("cpu_percent_per_core")]
        public List<double> CpuPercentPerCore { get; set; } = new();

        // Ilość aktualnie zajętej pamięci RAM (w GB)
        [JsonPropertyName("ram_used_gb")]
        public double RamUsedGb { get; set; }

        // Ilość aktualnie wolnej pamięci RAM (w GB)
        [JsonPropertyName("ram_available_gb")]
        public double RamAvailableGb { get; set; }

        // Procentowe zużycie pamięci RAM (%)
        [JsonPropertyName("ram_percent")]
        public double RamPercent { get; set; }
    }
}
