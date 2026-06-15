using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace ProjektAI.Backend.Models
{
    // Model reprezentujący pełną statyczną specyfikację podzespołów komputera (System Specs).
    public class SystemSpecs
    {
        // Nazwa i wersja systemu operacyjnego
        [JsonPropertyName("os")]
        public string Os { get; set; } = string.Empty;

        // Model procesora (CPU)
        [JsonPropertyName("cpu_model")]
        public string CpuModel { get; set; } = string.Empty;

        // Liczba fizycznych rdzeni procesora
        [JsonPropertyName("cpu_cores_physical")]
        public int CpuCoresPhysical { get; set; }

        // Liczba logicznych rdzeni/wątków procesora
        [JsonPropertyName("cpu_cores_logical")]
        public int CpuCoresLogical { get; set; }

        // Maksymalne taktowanie procesora w MHz
        [JsonPropertyName("cpu_max_frequency_mhz")]
        public double CpuMaxFrequencyMhz { get; set; }

        // Całkowita ilość pamięci operacyjnej RAM (w GB)
        [JsonPropertyName("ram_total_gb")]
        public double RamTotalGb { get; set; }

        // Prosta lista nazw wykrytych kart graficznych
        [JsonPropertyName("gpus")]
        public List<string> Gpus { get; set; } = new();

        // Szczegółowa lista kart graficznych wraz z rozmiarem pamięci VRAM
        [JsonPropertyName("gpu_details")]
        public List<GpuDetail> GpuDetails { get; set; } = new();

    }
}
