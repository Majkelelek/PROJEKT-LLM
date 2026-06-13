using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace NeuroBench.Backend.Models
{
    public class SystemSpecs
    {
        [JsonPropertyName("os")]
        public string Os { get; set; } = string.Empty;

        [JsonPropertyName("cpu_model")]
        public string CpuModel { get; set; } = string.Empty;

        [JsonPropertyName("cpu_cores_physical")]
        public int CpuCoresPhysical { get; set; }

        [JsonPropertyName("cpu_cores_logical")]
        public int CpuCoresLogical { get; set; }

        [JsonPropertyName("cpu_max_frequency_mhz")]
        public double CpuMaxFrequencyMhz { get; set; }

        [JsonPropertyName("ram_total_gb")]
        public double RamTotalGb { get; set; }

        [JsonPropertyName("gpus")]
        public List<string> Gpus { get; set; } = new();

        [JsonPropertyName("gpu_details")]
        public List<GpuDetail> GpuDetails { get; set; } = new();

        [JsonPropertyName("python_version")]
        public string PythonVersion { get; set; } = ".NET 8.0 (ASP.NET Core)";
    }
}
