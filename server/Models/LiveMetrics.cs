using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace NeuroBench.Backend.Models
{
    public class LiveMetrics
    {
        [JsonPropertyName("cpu_percent")]
        public double CpuPercent { get; set; }

        [JsonPropertyName("cpu_percent_per_core")]
        public List<double> CpuPercentPerCore { get; set; } = new();

        [JsonPropertyName("ram_used_gb")]
        public double RamUsedGb { get; set; }

        [JsonPropertyName("ram_available_gb")]
        public double RamAvailableGb { get; set; }

        [JsonPropertyName("ram_percent")]
        public double RamPercent { get; set; }
    }
}
