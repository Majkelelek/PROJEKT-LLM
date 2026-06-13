using System;
using System.Collections.Generic;
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

    public class OllamaResult
    {
        [JsonPropertyName("model")]
        public string Model { get; set; } = string.Empty;

        [JsonPropertyName("response")]
        public string Response { get; set; } = string.Empty;

        [JsonPropertyName("total_time_sec")]
        public double TotalTimeSec { get; set; }

        [JsonPropertyName("latency_sec")]
        public double LatencySec { get; set; }

        [JsonPropertyName("tokens_per_sec")]
        public double TokensPerSec { get; set; }

        [JsonPropertyName("prompt_eval_tokens_per_sec")]
        public double PromptEvalTokensPerSec { get; set; }

        [JsonPropertyName("tokens_generated")]
        public int TokensGenerated { get; set; }

        [JsonPropertyName("error")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? Error { get; set; }
    }

    public class BenchmarkResults
    {
        [JsonPropertyName("ollama")]
        public OllamaResult? Ollama { get; set; }
    }

    public class BenchmarkRun
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("timestamp")]
        public string Timestamp { get; set; } = string.Empty;

        [JsonPropertyName("specs")]
        public SystemSpecs? Specs { get; set; }

        [JsonPropertyName("results")]
        public BenchmarkResults? Results { get; set; }

        [JsonPropertyName("ai_report")]
        public string AiReport { get; set; } = string.Empty;

        [JsonPropertyName("selected_model")]
        public string SelectedModel { get; set; } = string.Empty;

        [JsonPropertyName("complexity")]
        public string Complexity { get; set; } = "medium";
    }

    public class RunBenchmarkRequest
    {
        [JsonPropertyName("model")]
        public string? Model { get; set; }

        [JsonPropertyName("tests")]
        public List<string> Tests { get; set; } = new() { "ollama" };

        [JsonPropertyName("complexity")]
        public string Complexity { get; set; } = "medium";
    }

    public class ChatRequestMessage
    {
        [JsonPropertyName("role")]
        public string Role { get; set; } = string.Empty;

        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;
    }

    public class ChatRequest
    {
        [JsonPropertyName("model")]
        public string Model { get; set; } = string.Empty;

        [JsonPropertyName("specs")]
        public SystemSpecs Specs { get; set; } = new();

        [JsonPropertyName("results")]
        public BenchmarkResults Results { get; set; } = new();

        [JsonPropertyName("history")]
        public List<ChatRequestMessage> History { get; set; } = new();
    }

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
