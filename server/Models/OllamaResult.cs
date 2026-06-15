using System.Text.Json.Serialization;

namespace ProjektAI.Backend.Models
{
    // Wynik szczegółowy testu wnioskowania (Inference Result) z lokalnej instancji Ollama.
    public class OllamaResult
    {
        // Nazwa modelu LLM, na którym przeprowadzono test
        [JsonPropertyName("model")]
        public string Model { get; set; } = string.Empty;

        // Odpowiedź tekstowa wygenerowana przez model
        [JsonPropertyName("response")]
        public string Response { get; set; } = string.Empty;

        // --- CZASY WNIOSKOWANIA (z /set verbose Ollamy) ---

        // Całkowity czas trwania generowania (w sekundach, s)
        [JsonPropertyName("total_time_sec")]
        public double TotalTimeSec { get; set; }

        // Czas ładowania modelu do pamięci (load_duration, s)
        [JsonPropertyName("load_duration_sec")]
        public double LoadDurationSec { get; set; }

        // Opóźnienie do pierwszego wygenerowanego tokenu (TTFT = load + prompt_eval, s)
        [JsonPropertyName("latency_sec")]
        public double LatencySec { get; set; }

        // Liczba tokenów w przetworzonej treści promptu (prompt_eval_count)
        [JsonPropertyName("prompt_eval_count")]
        public int PromptEvalCount { get; set; }

        // Czas przetwarzania promptu (prompt_eval_duration, s)
        [JsonPropertyName("prompt_eval_duration_sec")]
        public double PromptEvalDurationSec { get; set; }

        // Szybkość wstępnego przetwarzania promptu (prompt eval rate, token/s)
        [JsonPropertyName("prompt_eval_tokens_per_sec")]
        public double PromptEvalTokensPerSec { get; set; }

        // Liczba wygenerowanych tokenów w odpowiedzi (eval_count)
        [JsonPropertyName("tokens_generated")]
        public int TokensGenerated { get; set; }

        // Czas generowania odpowiedzi (eval_duration, s)
        [JsonPropertyName("eval_duration_sec")]
        public double EvalDurationSec { get; set; }

        // Szybkość generowania tekstu (eval rate, token/s)
        [JsonPropertyName("tokens_per_sec")]
        public double TokensPerSec { get; set; }

        // --- METRYKI GPU (z nvidia-smi, próbkowane podczas testu) ---

        // Użyta pamięć VRAM podczas testu (MB)
        [JsonPropertyName("gpu_vram_used_mb")]
        public long GpuVramUsedMb { get; set; }

        // Całkowita pamięć VRAM karty (MB)
        [JsonPropertyName("gpu_vram_total_mb")]
        public long GpuVramTotalMb { get; set; }

        // Obciążenie GPU podczas testu (%)
        [JsonPropertyName("gpu_util_percent")]
        public double GpuUtilPercent { get; set; }

        // Pobór mocy GPU podczas testu (W)
        [JsonPropertyName("gpu_power_draw_w")]
        public double GpuPowerDrawW { get; set; }

        // Maksymalny limit mocy GPU (W)
        [JsonPropertyName("gpu_power_limit_w")]
        public double GpuPowerLimitW { get; set; }

        // Temperatura GPU podczas testu (°C)
        [JsonPropertyName("gpu_temp_c")]
        public double GpuTempC { get; set; }

        // Czy metryki GPU (nvidia-smi) były dostępne na tym systemie
        [JsonPropertyName("gpu_metrics_available")]
        public bool GpuMetricsAvailable { get; set; }

        // --- METRYKI SYSTEMOWE (RAM / CPU, z WMI, próbkowane podczas testu) ---

        // Użyta pamięć RAM podczas testu (GB)
        [JsonPropertyName("sys_ram_used_gb")]
        public double SysRamUsedGb { get; set; }

        // Całkowita pamięć RAM systemu (GB)
        [JsonPropertyName("sys_ram_total_gb")]
        public double SysRamTotalGb { get; set; }

        // Procentowe zużycie RAM podczas testu (%)
        [JsonPropertyName("sys_ram_percent")]
        public double SysRamPercent { get; set; }

        // Procentowe obciążenie procesora podczas testu (%)
        [JsonPropertyName("sys_cpu_percent")]
        public double SysCpuPercent { get; set; }

        // Parametry modelu odczytane z Ollamy
        [JsonPropertyName("parameter_size")]
        public string ParameterSize { get; set; } = string.Empty;

        [JsonPropertyName("quantization_level")]
        public string QuantizationLevel { get; set; } = string.Empty;

        [JsonPropertyName("family")]
        public string Family { get; set; } = string.Empty;

        // Rzeczywisty rozmiar modelu w pamięci RAM/VRAM pobrany z /api/ps (w bajtach)
        [JsonPropertyName("model_size_bytes")]
        public long ModelSizeBytes { get; set; }

        [JsonPropertyName("model_size_vram_bytes")]
        public long ModelSizeVramBytes { get; set; }

        // Komunikat o błędzie (jeśli wystąpił podczas wykonywania testu)
        [JsonPropertyName("error")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public string? Error { get; set; }
    }
}
