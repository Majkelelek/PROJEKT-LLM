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
    /// <summary>
    /// Usługa kliencka obsługująca komunikację REST HTTP z lokalnym silnikiem uruchomieniowym Ollama.
    /// Odpowiada za odpytywanie o listę zainstalowanych modeli językowych, parametry modeli,
    /// przeprowadzanie testów wnioskowania (generowania tekstu) oraz pobieranie raportów analitycznych.
    /// </summary>
    public class OllamaClientService
    {
        private const string OllamaBaseUrl = "http://localhost:11434";
        private readonly HttpClient _httpClient;
        private readonly ILogger<OllamaClientService> _logger;

        /// <summary>
        /// Inicjalizuje instancję klienta Ollama. Ustawia 15-minutowy limit czasu żądania (timeout),
        /// co zabezpiecza przed przerwaniem pobierania danych w przypadku generowania długich raportów AI
        /// na słabszych konfiguracjach sprzętowych.
        /// </summary>
        public OllamaClientService(HttpClient httpClient, ILogger<OllamaClientService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            _httpClient.Timeout = TimeSpan.FromMinutes(15);
        }

        /// <summary>
        /// Wykonuje szybkie zapytanie diagnostyczne, aby potwierdzić czy lokalny demon Ollama jest aktywny.
        /// </summary>
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

        /// <summary>
        /// Pobiera szczegółowe informacje techniczne o zainstalowanych lokalnie modelach językowych.
        /// Odczytuje parametry takie jak rozmiar modelu, stopień kwantyzacji oraz przynależność do rodziny modeli.
        /// </summary>
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

        /// <summary>
        /// Uruchamia benchmark wydajnościowy dla wybranego modelu LLM. 
        /// Generuje obciążenie poprzez wykonanie zapytania tekstowego do modelu z parametrem stream=false.
        /// W trakcie generowania uruchamia równoległe monitorowanie karty graficznej przy użyciu nvidia-smi.
        /// </summary>
        /// <param name="model">Nazwa modelu do przetestowania (np. llama3.1)</param>
        /// <param name="complexity">Poziom trudności testu: quick, medium, complex</param>
        /// <param name="sysInfo">Serwis telemetryczny używany do równoległego próbkowania GPU i snapshotów RAM/CPU</param>
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
                    prompt = "Wyjaśnij w jednym zdaniu, czym jest sztuczna inteligencja. Pisz poprawnie po polsku, krótko i bez powtórzeń.";
                    numPredict = 150;
                    temp = 0.1;
                    break;
                case "complex":
                    prompt = "Napisz wyczerpujący i szczegółowy artykuł na temat ewolucji mikroprocesorów od lat 70. do dziś, wyjaśniając różnice między architekturami CISC a RISC, x86 a ARM oraz znaczenie rozszerzeń wektorowych AVX i rdzeni Tensor w nowoczesnym wnioskowaniu sztucznej inteligencji. Artykuł powinien mieć co najmniej 5 akapitów. Dbaj o poprawność językową, pisz naturalną polszczyzną, unikaj powtórzeń zdań i zakończ tekst naturalnym podsumowaniem.";
                    numPredict = 3000;
                    temp = 0.7;
                    break;
                case "medium":
                default:
                    prompt = "Napisz krótki esej składający się z dwóch akapitów, wyjaśniający czym jest uczenie maszynowe (Machine Learning) oraz jak sieci neuronowe przetwarzają informacje. Zadbaj o poprawność językową, pisz naturalną polszczyzną i unikaj zbędnych powtórzeń.";
                    numPredict = 1000;
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
                    num_gpu = -1, // Pozwól Ollamie zdecydować o automatycznym podziale warstw na GPU/CPU
                    repeat_penalty = 1.15f,
                    repeat_last_n = 64
                }
            };

            // Próbkowanie metryk systemowych (RAM/CPU) PRZED uruchomieniem wnioskowania
            var (ramBefore, _, _, _) = sysInfo != null ? sysInfo.GetSystemSnapshot() : (0, 0, 0, 0);

            // Wartości szczytowe GPU zbierane w trakcie wnioskowania
            double peakVramUsed = 0, peakVramTotal = 0, peakGpuUtil = 0;
            double peakPowerDraw = 0, peakPowerLimit = 0, peakGpuTemp = 0;
            bool gpuAvailable = false;

            // Uruchamiamy pętlę próbkującą GPU w tle — zbiera wartości co 750ms przez cały czas generowania
            using var cts = new CancellationTokenSource();
            var samplingTask = Task.Run(async () =>
            {
                if (sysInfo == null) return;
                _logger.LogInformation("[Telemetry] Rozpoczęto próbkowanie GPU w tle (częstotliwość: 750ms).");
                while (!cts.Token.IsCancellationRequested)
                {
                    var sample = await sysInfo.GetNvidiaSmiAsync();
                    if (sample.Count > 0)
                    {
                        gpuAvailable = true;
                        sample.TryGetValue("vram_used_mb", out double vUsed);
                        sample.TryGetValue("vram_total_mb", out double vTotal);
                        sample.TryGetValue("gpu_util", out double util);
                        sample.TryGetValue("power_draw", out double power);
                        sample.TryGetValue("power_limit", out double powerLim);
                        sample.TryGetValue("temperature", out double temp2);

                        _logger.LogInformation("[Telemetry] Pobrano próbkę GPU: VRAM={vUsed}MB, Obciążenie={util}%, Pobór mocy={power}W, Temp={temp2}°C", vUsed, util, power, temp2);

                        if (vUsed    > peakVramUsed)   peakVramUsed   = vUsed;
                        if (vTotal   > peakVramTotal)   peakVramTotal  = vTotal;
                        if (util     > peakGpuUtil)     peakGpuUtil    = util;
                        if (power    > peakPowerDraw)   peakPowerDraw  = power;
                        if (powerLim > peakPowerLimit)  peakPowerLimit = powerLim;
                        if (temp2    > peakGpuTemp)     peakGpuTemp    = temp2;
                    }
                    try { await Task.Delay(750, cts.Token); }
                    catch (TaskCanceledException) { break; }
                }
            }, cts.Token);

            var stopwatch = Stopwatch.StartNew();

            _logger.LogInformation("Wysyłanie żądania benchmarku do Ollama dla modelu: {Model} (złożoność: {Complexity})", model, complexity);
            var response = await _httpClient.PostAsJsonAsync($"{OllamaBaseUrl}/api/generate", payload);
            stopwatch.Stop();

            // Zatrzymujemy pętlę próbkującą po zakończeniu generowania
            await cts.CancelAsync();
            try { await samplingTask; } catch { /* ignorujemy TaskCanceledException */ }

            _logger.LogInformation("[Telemetry] Zakończono próbkowanie GPU. Wartości szczytowe: Peak VRAM={peakVramUsed}MB, Peak Util={peakGpuUtil}%, Peak Temp={peakGpuTemp}°C, Peak Power={peakPowerDraw}W", peakVramUsed, peakGpuUtil, peakGpuTemp, peakPowerDraw);

            // Odpytujemy silnik Ollama o rzeczywistą alokację pamięci załadowanego modelu z punktu końcowego /api/ps
            long modelSizeBytes = 0;
            long modelSizeVramBytes = 0;
            try
            {
                var psResponse = await _httpClient.GetAsync($"{OllamaBaseUrl}/api/ps");
                if (psResponse.IsSuccessStatusCode)
                {
                    var psData = await psResponse.Content.ReadFromJsonAsync<OllamaPsResponse>();
                    if (psData?.Models != null)
                    {
                        var activeModel = psData.Models.Find(m => m.Name == model || m.Model == model);
                        if (activeModel != null)
                        {
                            modelSizeBytes = activeModel.SizeBytes;
                            modelSizeVramBytes = activeModel.SizeVramBytes;
                            _logger.LogInformation("[Telemetry] Odczytano rzeczywistą zajętość z /api/ps: Model={Model}, Pamięć ogółem={Size} B ({SizeGb:F2} GB), w tym VRAM={SizeVram} B ({SizeVramGb:F2} GB)", 
                                activeModel.Name, modelSizeBytes, modelSizeBytes / 1e9, modelSizeVramBytes, modelSizeVramBytes / 1e9);
                        }
                        else
                        {
                            _logger.LogWarning("[Telemetry] Nie znaleziono modelu '{Model}' w aktywnych modelach /api/ps", model);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Telemetry] Błąd pobierania danych o pamięci załadowanego modelu z /api/ps");
            }

            // Pobieramy końcową migawkę RAM/CPU (po obciążeniu)
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
            // Używamy wartości szczytowych zebranych w trakcie całego testu
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

                // Metryki GPU (nvidia-smi) — wartości szczytowe z całego okresu generowania
                GpuMetricsAvailable = gpuAvailable,
                GpuVramUsedMb = (long)peakVramUsed,
                GpuVramTotalMb = (long)peakVramTotal,
                GpuUtilPercent = Math.Round(peakGpuUtil, 1),
                GpuPowerDrawW = Math.Round(peakPowerDraw, 1),
                GpuPowerLimitW = Math.Round(peakPowerLimit, 1),
                GpuTempC = Math.Round(peakGpuTemp, 1),

                // Metryki systemowe (WMI)
                SysRamUsedGb = ramAfterUsed,
                SysRamTotalGb = ramAfterTotal,
                SysRamPercent = ramAfterPct,
                SysCpuPercent = cpuAfterPct,

                // Parametry modelu odczytane z Ollamy
                ParameterSize = paramSize,
                QuantizationLevel = quantLevel,
                Family = family,
                ModelSizeBytes = modelSizeBytes,
                ModelSizeVramBytes = modelSizeVramBytes
            };
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

        private class OllamaPsResponse
        {
            [JsonPropertyName("models")]
            public List<OllamaPsModelItem>? Models { get; set; }
        }

        private class OllamaPsModelItem
        {
            [JsonPropertyName("name")]
            public string? Name { get; set; }

            [JsonPropertyName("model")]
            public string? Model { get; set; }

            [JsonPropertyName("size")]
            public long SizeBytes { get; set; }

            [JsonPropertyName("size_vram")]
            public long SizeVramBytes { get; set; }
        }
    }
}
