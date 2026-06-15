using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using ProjektAI.Backend.Models;

namespace ProjektAI.Backend.Services
{
    // Klient HTTP do komunikacji z lokalną usługą Ollama na porcie 11434.
    public class OllamaClientService
    {
        private const string OllamaBaseUrl = "http://localhost:11434";
        private readonly HttpClient _httpClient;
        private readonly ILogger<OllamaClientService> _logger;

        // Inicjalizacja klienta i ustawienie limitu czasu (timeout) na 15 minut (potrzebne przy cięższych modelach/raportach)
        public OllamaClientService(HttpClient httpClient, ILogger<OllamaClientService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            _httpClient.Timeout = TimeSpan.FromMinutes(15);
        }

        // Sprawdza czy usługa Ollama działa, wysyłając szybkie zapytanie do API tags
        public async Task<bool> IsOllamaRunningAsync()
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2.0));
                var response = await _httpClient.GetAsync($"{OllamaBaseUrl}/api/tags", cts.Token);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        // Pobiera listę nazw wszystkich modeli pobranych lokalnie w Ollamie
        public async Task<List<string>> GetOllamaModelsAsync()
        {
            var modelsList = new List<string>();
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3.0));
                var response = await _httpClient.GetAsync($"{OllamaBaseUrl}/api/tags", cts.Token);
                if (response.IsSuccessStatusCode)
                {
                    var data = await response.Content.ReadFromJsonAsync<OllamaTagsResponse>(cancellationToken: cts.Token);
                    if (data?.Models != null)
                    {
                        foreach (var model in data.Models)
                        {
                            if (!string.IsNullOrEmpty(model.Name))
                            {
                                modelsList.Add(model.Name);
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Nie udało się pobrać listy modeli z usługi Ollama");
            }
            return modelsList;
        }

        // Pobiera szczegółową listę modeli pobranych lokalnie w Ollamie
        public async Task<List<OllamaModelInfo>> GetOllamaModelsDetailedAsync()
        {
            var modelsList = new List<OllamaModelInfo>();
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3.0));
                var response = await _httpClient.GetAsync($"{OllamaBaseUrl}/api/tags", cts.Token);
                if (response.IsSuccessStatusCode)
                {
                    var data = await response.Content.ReadFromJsonAsync<OllamaTagsResponse>(cancellationToken: cts.Token);
                    if (data?.Models != null)
                    {
                        foreach (var model in data.Models)
                        {
                            if (!string.IsNullOrEmpty(model.Name))
                            {
                                modelsList.Add(new OllamaModelInfo
                                {
                                    Name = model.Name,
                                    ParameterSize = model.Details?.ParameterSize ?? string.Empty,
                                    QuantizationLevel = model.Details?.QuantizationLevel ?? string.Empty,
                                    Family = model.Details?.Family ?? string.Empty
                                });
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Nie udało się pobrać szczegółowej listy modeli z usługi Ollama");
            }
            return modelsList;
        }

        // Uruchamia test wydajnościowy (Benchmark) dla wybranego modelu LLM na określonym poziomie złożoności.
        // Opcjonalnie przyjmuje SystemInfoService do próbkowania metryk GPU i RAM podczas testu.
        public async Task<OllamaResult> RunLlmBenchmarkAsync(string model, string complexity = "medium", SystemInfoService? sysInfo = null)
        {
            string paramSize = "";
            string quantLevel = "";
            string family = "";
            try
            {
                var detailedModels = await GetOllamaModelsDetailedAsync();
                var match = detailedModels.Find(m => m.Name == model);
                if (match != null)
                {
                    paramSize = match.ParameterSize;
                    quantLevel = match.QuantizationLevel;
                    family = match.Family;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Nie udało się pobrać metryk modelu {Model} z tags: {Message}", model, ex.Message);
            }

            string prompt;
            int numPredict;
            double temp;

            // Dobór parametrów testu i promptu w zależności od poziomu złożoności wybranego przez użytkownika
            switch (complexity?.ToLower())
            {
                case "quick":
                    prompt = "Wyjaśnij w jednym zdaniu, czym jest sztuczna inteligencja.";
                    numPredict = 1200;
                    temp = 0.1;
                    break;
                case "complex":
                    prompt = "Napisz wyczerpujący i szczegółowy artykuł na temat ewolucji mikroprocesorów od lat 70. do dziś, wyjaśniając różnice między architekturami CISC a RISC, x86 a ARM oraz znaczenie rozszerzeń wektorowych AVX i rdzeni Tensor w nowoczesnym wnioskowaniu sztucznej inteligencji. Artykuł powinien mieć co najmniej 5 akapitów.";
                    numPredict = 15000;
                    temp = 0.7;
                    break;
                case "medium":
                default:
                    prompt = "Napisz krótki esej składający się z dwóch akapitów, wyjaśniający czym jest uczenie maszynowe (Machine Learning) oraz jak sieci neuronowe przetwarzają informacje.";
                    numPredict = 6000;
                    temp = 0.4;
                    break;
            }
            
            var payload = new
            {
                model = model,
                prompt = prompt,
                stream = false,
                options = new
                {
                    temperature = temp,
                    num_predict = numPredict,
                    num_gpu = -1 // Pozwól Ollamie zdecydować o automatycznym podziale warstw na GPU/CPU
                }
            };

            // Próbkowanie metryk GPU i systemowych PRZED uruchomieniem wnioskowania
            var gpuBefore = sysInfo != null ? await sysInfo.GetNvidiaSmiAsync() : new System.Collections.Generic.Dictionary<string, double>();
            var (ramBefore, _, _, _) = sysInfo != null ? sysInfo.GetSystemSnapshot() : (0, 0, 0, 0);

            var stopwatch = Stopwatch.StartNew();
            
            _logger.LogInformation("Wysyłanie żądania benchmarku do Ollama dla modelu: {Model} (złożoność: {Complexity})", model, complexity);
            var response = await _httpClient.PostAsJsonAsync($"{OllamaBaseUrl}/api/generate", payload);
            stopwatch.Stop();

            // Próbkowanie metryk GPU i systemowych PO zakończeniu wnioskowania
            var gpuAfter = sysInfo != null ? await sysInfo.GetNvidiaSmiAsync() : new System.Collections.Generic.Dictionary<string, double>();
            var (ramAfterUsed, ramAfterTotal, ramAfterPct, cpuAfterPct) = sysInfo != null ? sysInfo.GetSystemSnapshot() : (0, 0, 0, 0);

            if (!response.IsSuccessStatusCode)
            {
                var errorText = await response.Content.ReadAsStringAsync();
                throw new Exception($"Usługa Ollama zwróciła status {response.StatusCode}: {errorText}");
            }

            var data = await response.Content.ReadFromJsonAsync<OllamaGenerateResponse>();
            if (data == null)
            {
                throw new Exception("Usługa Ollama zwróciła pustą odpowiedź.");
            }

            // Przeliczanie nanosekund zwracanych przez Ollama na sekundy oraz obliczenie wskaźników wydajnościowych
            double totalDurationSec = data.TotalDuration / 1e9;
            if (totalDurationSec <= 0) totalDurationSec = stopwatch.Elapsed.TotalSeconds;

            double loadDurationSec = data.LoadDuration / 1e9;
            double promptEvalDurationSec = data.PromptEvalDuration / 1e9;
            double latencySec = loadDurationSec + promptEvalDurationSec;
            if (latencySec <= 0) latencySec = stopwatch.Elapsed.TotalSeconds;

            double evalDurationSec = data.EvalDuration / 1e9;
            double tokensPerSec = evalDurationSec > 0 ? data.EvalCount / evalDurationSec : 0;
            double promptEvalTokensPerSec = promptEvalDurationSec > 0 ? data.PromptEvalCount / promptEvalDurationSec : 0;

            // Użyjemy wartości zmierzone PO teście (szczyt zużycia) jako bardziej reprezentatywnych
            bool gpuAvailable = gpuAfter.Count > 0;
            gpuAfter.TryGetValue("vram_used_mb", out double vramUsed);
            gpuAfter.TryGetValue("vram_total_mb", out double vramTotal);
            gpuAfter.TryGetValue("gpu_util", out double gpuUtil);
            gpuAfter.TryGetValue("power_draw", out double powerDraw);
            gpuAfter.TryGetValue("power_limit", out double powerLimit);
            gpuAfter.TryGetValue("temperature", out double gpuTemp);

            return new OllamaResult
            {
                Model = model,
                Response = data.Response,

                // Czasy Ollama (verbose)
                TotalTimeSec = Math.Round(totalDurationSec, 2),
                LoadDurationSec = Math.Round(loadDurationSec, 2),
                LatencySec = Math.Round(latencySec, 2),
                PromptEvalCount = data.PromptEvalCount,
                PromptEvalDurationSec = Math.Round(promptEvalDurationSec, 2),
                PromptEvalTokensPerSec = Math.Round(promptEvalTokensPerSec, 2),
                TokensGenerated = data.EvalCount,
                EvalDurationSec = Math.Round(evalDurationSec, 2),
                TokensPerSec = Math.Round(tokensPerSec, 2),

                // Metryki GPU (nvidia-smi)
                GpuMetricsAvailable = gpuAvailable,
                GpuVramUsedMb = (long)vramUsed,
                GpuVramTotalMb = (long)vramTotal,
                GpuUtilPercent = Math.Round(gpuUtil, 1),
                GpuPowerDrawW = Math.Round(powerDraw, 1),
                GpuPowerLimitW = Math.Round(powerLimit, 1),
                GpuTempC = Math.Round(gpuTemp, 1),

                // Metryki systemowe (WMI)
                SysRamUsedGb = ramAfterUsed,
                SysRamTotalGb = ramAfterTotal,
                SysRamPercent = ramAfterPct,
                SysCpuPercent = cpuAfterPct,

                // Parametry modelu odczytane z Ollamy
                ParameterSize = paramSize,
                QuantizationLevel = quantLevel,
                Family = family
            };
        }

        // Generuje kompleksowy raport z analizy AI wydajności systemu za pomocą LLM w Ollamie
        public async Task<string> GenerateAiReportAsync(SystemSpecs specs, BenchmarkResults results, string model, string complexity = "medium")
        {
            var gpuSpecsList = new List<string>();
            if (specs.GpuDetails != null && specs.GpuDetails.Count > 0)
            {
                foreach (var detail in specs.GpuDetails)
                {
                    gpuSpecsList.Add($"{detail.Name} ({detail.VramGb:F1} GB VRAM)");
                }
            }
            else
            {
                foreach (var gpu in specs.Gpus)
                {
                    gpuSpecsList.Add(gpu);
                }
            }
            var gpusJoined = string.Join(", ", gpuSpecsList);

            var ollamaRes = results.Ollama;
            var tps = ollamaRes?.TokensPerSec ?? 0;
            var promptTps = ollamaRes?.PromptEvalTokensPerSec ?? 0;
            var latency = ollamaRes?.LatencySec ?? 0;
            var testedModel = ollamaRes?.Model ?? "Brak";

            var gpuUsageInfo = "";
            var sysMetricsInfo = "";
            if (ollamaRes != null)
            {
                sysMetricsInfo = $"\n- Zużycie pamięci RAM systemu: {ollamaRes.SysRamUsedGb:F1} GB z {ollamaRes.SysRamTotalGb:F1} GB ({ollamaRes.SysRamPercent}%)\n- Średnie obciążenie CPU systemu podczas testu: {ollamaRes.SysCpuPercent}%";
                if (ollamaRes.GpuMetricsAvailable)
                {
                    gpuUsageInfo = $"\n- Rzeczywiste obciążenie GPU podczas testu: {ollamaRes.GpuUtilPercent}%\n- Wykorzystanie pamięci VRAM GPU na koniec testu: {ollamaRes.GpuVramUsedMb} MB z {ollamaRes.GpuVramTotalMb} MB\n- Średni pobór mocy GPU: {ollamaRes.GpuPowerDrawW} W (Limit: {ollamaRes.GpuPowerLimitW} W)\n- Temperatura robocza GPU: {ollamaRes.GpuTempC}°C";
                }
                else
                {
                    gpuUsageInfo = "\n- Pomiary GPU: Wykorzystanie dedykowanej karty graficznej i pamięci VRAM było niedostępne podczas testu (model mógł działać na procesorze CPU/RAM).";
                }
            }

            string prompt;
            int numPredict;
            double temp;

            // Syntetyzowanie dedykowanego promptu do analizy AI w zależności od wybranego poziomu złożoności raportu
            switch (complexity?.ToLower())
            {
                case "quick":
                    prompt = $@"
Jesteś ekspert ds. sprzętu komputerowego.
Przeanalizuj poniższe specyfikacje komputera oraz wyniki testu wydajności wnioskowania lokalnego LLM i napisz KRÓTKIE podsumowanie (maksymalnie 3 zdania) po polsku oceniające ten sprzęt pod AI.

### SPECYFIKACJA SYSTEMU
- System operacyjny: {specs.Os}
- Procesor (CPU): {specs.CpuModel} ({specs.CpuCoresPhysical} rdzeni fizycznych, {specs.CpuCoresLogical} wątków logicznych)
- Pamięć RAM: {specs.RamTotalGb} GB
- Karta(y) graficzna(e): {gpusJoined}

### WYNIKI TESTU LLM
- Wnioskowanie (Ollama - {testedModel}): {tps} t/s, TTFT: {latency}s.{sysMetricsInfo}{gpuUsageInfo}
";
                    numPredict = 150;
                    temp = 0.1;
                    break;

                case "medium":
                    prompt = $@"
Jesteś ekspertem ds. sprzętu komputerowego.
Napisz zwięzłą i konkretną ocenę wydajności AI po polsku (około 2-3 akapitów).
Opisz ogólną klasę sprzętu pod AI, zidentyfikuj główne wąskie gardła i podaj najważniejsze rekomendacje uaktualnień.

### SPECYFIKACJA SYSTEMU
- System operacyjny: {specs.Os}
- Procesor (CPU): {specs.CpuModel} ({specs.CpuCoresPhysical} rdzeni fizycznych, {specs.CpuCoresLogical} wątków logicznych)
- Pamięć RAM: {specs.RamTotalGb} GB
- Karta(y) graficzna(e): {gpusJoined}

### WYNIKI TESTU LLM
- Wnioskowanie (Ollama - {testedModel}): {tps} t/s, TTFT: {latency}s.{sysMetricsInfo}{gpuUsageInfo}
";
                    numPredict = 500;
                    temp = 0.3;
                    break;

                case "complex":
                default:
                    prompt = $@"
Jesteś ekspertem ds. sprzętu komputerowego i analitykiem wydajności systemów.
Przeanalizuj poniższe specyfikacje komputera oraz wyniki testu wydajności wnioskowania lokalnego LLM i napisz profesjonalny raport z analizy sprzętu pod kątem zadań AI.

### SPECYFIKACJA SYSTEMU
- System operacyjny: {specs.Os}
- Procesor (CPU): {specs.CpuModel} ({specs.CpuCoresPhysical} rdzeni fizycznych, {specs.CpuCoresLogical} wątków logicznych)
- Pamięć RAM: {specs.RamTotalGb} GB
- Karta(y) graficzna(e): {gpusJoined}
- Wersja platformy: {specs.PythonVersion}

### WYNIKI TESTU LLM
- **Wnioskowanie LLM (Ollama - {testedModel})**:
  - Prędkość generowania odpowiedzi (eval rate): {tps} tokenów/sekundę
  - Prędkość oceny promptu (prompt eval rate): {promptTps} tokenów/sekundę
  - Opóźnienie do pierwszego tokenu (TTFT / latency): {latency} sekund{sysMetricsInfo}{gpuUsageInfo}

Wygeneruj pięknie sformatowany raport w formacie Markdown zawierający:
1. **Podsumowanie menedżerskie (Executive Summary)**: Ogólna ocena klasy wydajnościowej maszyny pod kątem lokalnych zadań AI/LLM.
2. **Szczegółowa analiza podzespołów**:
   - Analiza wydajności wnioskowania LLM (tokenów/sekundę) w odniesieniu do specyfikacji (CPU, RAM, GPU).
   - Określenie czy model działa w pełni na GPU, CPU, czy w trybie hybrydowym, opierając się na faktycznym zużyciu pamięci RAM/VRAM i obciążeniu GPU/CPU podczas testu. Zinterpretuj także opóźnienie do pierwszego tokenu.
3. **Analiza wąskich gardeł**: Zidentyfikuj co ogranicza szybkość lokalnego LLM (np. za mało VRAM w GPU, wolna pamięć RAM itp.).
4. **Rekomendacje uaktualnień (Upgrades)**: Co użytkownik powinien wymienić lub dokupić (np. GPU z większą ilością VRAM), aby najbardziej przyspieszyć działanie lokalnych modeli LLM.
5. **Najlepsze zastosowania**: Do jakich zadań AI ten komputer nadaje się najlepiej (np. lekkie modele 3B, chat, RAG, asystent kodowania).

Raport musi być w całości napisany w języku polskim. Użyj profesjonalnego, obiektywnego i rzeczowego tonu. Unikaj pustych szablonów tekstowych. Stosuj czysty Markdown.
";
                    numPredict = 1200;
                    temp = 0.5;
                    break;
            }

            var payload = new
            {
                model = model,
                prompt = prompt,
                stream = false,
                options = new
                {
                    temperature = temp,
                    num_predict = numPredict,
                    num_gpu = -1
                }
            };

            _logger.LogInformation("Generowanie raportu AI przy użyciu modelu: {Model} (złożoność: {Complexity})", model, complexity);
            var response = await _httpClient.PostAsJsonAsync($"{OllamaBaseUrl}/api/generate", payload);
            if (response.IsSuccessStatusCode)
            {
                var data = await response.Content.ReadFromJsonAsync<OllamaGenerateResponse>();
                return data?.Response ?? "Błąd: Pusta odpowiedź z usługi Ollama";
            }
            else
            {
                var errorText = await response.Content.ReadAsStringAsync();
                return $"Błąd podczas generowania raportu przez Ollama: {errorText}";
            }
        }

        // --- Wewnętrzne klasy pomocnicze do deserializacji JSON ---

        private class OllamaTagsResponse
        {
            [JsonPropertyName("models")]
            public List<OllamaModelItem>? Models { get; set; }
        }

        private class OllamaModelItem
        {
            [JsonPropertyName("name")]
            public string? Name { get; set; }

            [JsonPropertyName("details")]
            public OllamaModelItemDetails? Details { get; set; }
        }

        private class OllamaModelItemDetails
        {
            [JsonPropertyName("parameter_size")]
            public string? ParameterSize { get; set; }

            [JsonPropertyName("quantization_level")]
            public string? QuantizationLevel { get; set; }

            [JsonPropertyName("family")]
            public string? Family { get; set; }
        }

        private class OllamaGenerateResponse
        {
            [JsonPropertyName("response")]
            public string Response { get; set; } = string.Empty;

            [JsonPropertyName("total_duration")]
            public long TotalDuration { get; set; }

            [JsonPropertyName("load_duration")]
            public long LoadDuration { get; set; }

            [JsonPropertyName("prompt_eval_duration")]
            public long PromptEvalDuration { get; set; }

            [JsonPropertyName("eval_duration")]
            public long EvalDuration { get; set; }

            [JsonPropertyName("prompt_eval_count")]
            public int PromptEvalCount { get; set; }

            [JsonPropertyName("eval_count")]
            public int EvalCount { get; set; }
        }
    }
}
