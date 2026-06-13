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
using NeuroBench.Backend.Models;

namespace NeuroBench.Backend.Services
{
    public class OllamaClientService
    {
        private const string OllamaBaseUrl = "http://localhost:11434";
        private readonly HttpClient _httpClient;
        private readonly ILogger<OllamaClientService> _logger;

        public OllamaClientService(HttpClient httpClient, ILogger<OllamaClientService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            // Configure default timeouts
            _httpClient.Timeout = TimeSpan.FromMinutes(15); // Long timeout for generating reports or benchmarks
        }

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
                _logger.LogWarning(ex, "Failed to get models from Ollama");
            }
            return modelsList;
        }

        public async Task<OllamaResult> RunLlmBenchmarkAsync(string model, string complexity = "medium")
        {
            string prompt;
            int numPredict;
            double temp;

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
                    num_gpu = -1
                }
            };

            var stopwatch = Stopwatch.StartNew();
            
            _logger.LogInformation("Sending benchmark request to Ollama for model: {Model} (complexity: {Complexity})", model, complexity);
            var response = await _httpClient.PostAsJsonAsync($"{OllamaBaseUrl}/api/generate", payload);
            stopwatch.Stop();

            if (!response.IsSuccessStatusCode)
            {
                var errorText = await response.Content.ReadAsStringAsync();
                throw new Exception($"Ollama returned status {response.StatusCode}: {errorText}");
            }

            var data = await response.Content.ReadFromJsonAsync<OllamaGenerateResponse>();
            if (data == null)
            {
                throw new Exception("Ollama returned an empty response.");
            }

            double totalDurationSec = data.TotalDuration / 1e9;
            if (totalDurationSec <= 0) totalDurationSec = stopwatch.Elapsed.TotalSeconds;

            double latencySec = (data.LoadDuration + data.PromptEvalDuration) / 1e9;
            if (latencySec <= 0) latencySec = stopwatch.Elapsed.TotalSeconds;

            double evalDurationSec = data.EvalDuration / 1e9;
            double tokensPerSec = evalDurationSec > 0 ? data.EvalCount / evalDurationSec : 0;

            double promptEvalSec = data.PromptEvalDuration / 1e9;
            double promptEvalTokensPerSec = promptEvalSec > 0 ? data.PromptEvalCount / promptEvalSec : 0;

            return new OllamaResult
            {
                Model = model,
                Response = data.Response,
                TotalTimeSec = Math.Round(totalDurationSec, 2),
                LatencySec = Math.Round(latencySec, 2),
                TokensPerSec = Math.Round(tokensPerSec, 2),
                PromptEvalTokensPerSec = Math.Round(promptEvalTokensPerSec, 2),
                TokensGenerated = data.EvalCount
            };
        }

        public async Task<string> GenerateAiReportAsync(SystemSpecs specs, BenchmarkResults results, string model, string complexity = "medium")
        {
            var gpusJoined = string.Join(", ", specs.Gpus);
            var ollamaRes = results.Ollama;
            var tps = ollamaRes?.TokensPerSec ?? 0;
            var promptTps = ollamaRes?.PromptEvalTokensPerSec ?? 0;
            var latency = ollamaRes?.LatencySec ?? 0;
            var testedModel = ollamaRes?.Model ?? "Brak";

            string prompt;
            int numPredict;
            double temp;

            switch (complexity?.ToLower())
            {
                case "quick":
                    prompt = $@"
Jesteś ekspert ds. sprzętu komputerowego.
Przeanalizuj poniższe specyfikacje komputera oraz wyniki testu wydajności wnioskowania lokalnego LLM i napisz KRÓTKIE podsumowanie (maksymalnie 3 zdania) po polsku oceniające ten sprzęt.

### SPECYFIKACJA SYSTEMU
- System operacyjny: {specs.Os}
- Procesor (CPU): {specs.CpuModel} ({specs.CpuCoresPhysical} rdzeni fizycznych, {specs.CpuCoresLogical} wątków logicznych)
- Pamięć RAM: {specs.RamTotalGb} GB
- Karta(y) graficzna(e): {gpusJoined}

### WYNIKI TESTU LLM
- Wnioskowanie (Ollama - {testedModel}): {tps} t/s, TTFT: {latency}s.
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
- Wnioskowanie (Ollama - {testedModel}): {tps} t/s, TTFT: {latency}s.
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
  - Prędkość generowania odpowiedzi: {tps} tokenów/sekundę
  - Prędkość oceny promptu: {promptTps} tokenów/sekundę
  - Opóźnienie do pierwszego tokenu: {latency} sekund

Wygeneruj pięknie sformatowany raport w formacie Markdown zawierający:
1. **Podsumowanie menedżerskie (Executive Summary)**: Ogólna ocena klasy wydajnościowej maszyny pod kątem lokalnych zadań AI/LLM.
2. **Szczegółowa analiza podzespołów**:
   - Analiza wydajności wnioskowania LLM (tokenów/sekundę) w odniesieniu to specyfikacji (CPU, RAM, GPU).
   - Określenie czy model działa w pełni na GPU, CPU, czy w trybie hybrydowym, i zinterpretowanie opóźnienia do pierwszego tokenu.
3. **Analiza wąskich gardeł**: Zidentyfikuj co ogranicza szybkość lokalnego LLM (np. za mało VRAM w GPU, wolna pamięć RAM itp.).
4. **Rekomendacje uaktualnień (Upgrades)**: Co użytkownik powinien wymienić lub dokupić (np. GPU z większą ilością VRAM), aby najbardziej przyspieszyć działanie lokalnych modeli LLM.
5. **Najlepsze zastosowania**: Do jakich zadań AI ten komputer nadaje się najlepiej (np. lekkie modele 3B, chat, RAG, asystent kodowania).

Raport must być w całości napisany w języku polskim. Użyj profesjonalnego, obiektywnego i rzeczowego tonu. Unikaj pustych szablonów tekstowych. Stosuj czysty Markdown.
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

            _logger.LogInformation("Generating AI Report using model: {Model} (complexity: {Complexity})", model, complexity);
            var response = await _httpClient.PostAsJsonAsync($"{OllamaBaseUrl}/api/generate", payload);
            if (response.IsSuccessStatusCode)
            {
                var data = await response.Content.ReadFromJsonAsync<OllamaGenerateResponse>();
                return data?.Response ?? "Error: Empty response from Ollama";
            }
            else
            {
                var errorText = await response.Content.ReadAsStringAsync();
                return $"Error running Ollama report generation: {errorText}";
            }
        }

        public async IAsyncEnumerable<string> StreamChatResponseAsync(
            string model,
            SystemSpecs specs,
            BenchmarkResults results,
            List<ChatRequestMessage> history,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var gpusJoined = string.Join(", ", specs.Gpus);
            var ollamaRes = results.Ollama;
            var tps = ollamaRes?.TokensPerSec ?? 0;
            var promptTps = ollamaRes?.PromptEvalTokensPerSec ?? 0;
            var latency = ollamaRes?.LatencySec ?? 0;
            var testedModel = ollamaRes?.Model ?? "Brak";

            var systemPrompt = $@"
Jesteś ""Asystentem AI ds. Sprzętu"" (Hardware AI Analyst) – wyspecjalizowanym asystentem wbudowanym w panel benchmarkowy.
Twoim jedynym zadaniem jest odpowiadanie po polsku na pytania użytkownika dotyczące jego systemu pod kątem lokalnego uruchamiania LLM, bazując wyłącznie na poniższych danych.

KRYTYCZNE ZASADY:
- ZAWSZE ODPOWIADAJ PO POLSKU!
- Używaj TYLKO danych podanych w tym prompcie. Nie zmyślaj, nie zakładaj ani nie zgaduj parametrów sprzętu ani wyników.
- Jeśli użytkownik pyta o coś, czego nie ma w danych, odpowiedz: ""Nie posiadam tych informacji z przeprowadzonego benchmarku.""
- Odpowiedzi muszą być zwięzłe, rzeczowe i techniczne. Bez zbędnego owijania w bawełnę.
- Zawsze odwołuj się do konkretnych liczb z wyników testów, jeśli są one powiązane z pytaniem.

### SPECYFIKACJA SYSTEMU
- System operacyjny: {specs.Os}
- Procesor (CPU): {specs.CpuModel} ({specs.CpuCoresPhysical} rdzeni fizycznych, {specs.CpuCoresLogical} wątków logicznych)
- Pamięć RAM: {specs.RamTotalGb} GB
- Karta(y) graficzna(e): {gpusJoined}

### WYNIKI BENCHMARKA (tylko z tej sesji)
- Szybkość wnioskowania LLM: {tps} tokenów/s (Testowany model: {testedModel})
- Opóźnienie do pierwszego tokenu: {latency} s
- Szybkość oceny promptu: {promptTps} tokenów/s

Odpowiadaj wyłącznie w oparciu o powyższe dane. Pisz bezpośrednio, konkretnie i technicznie.
";

            var messages = new List<object>
            {
                new { role = "system", content = systemPrompt }
            };

            foreach (var msg in history)
            {
                messages.Add(new { role = msg.Role, content = msg.Content });
            }

            var payload = new
            {
                model = model,
                messages = messages,
                stream = true,
                options = new
                {
                    temperature = 0.2,
                    num_predict = 600,
                    num_gpu = -1
                }
            };

            var request = new HttpRequestMessage(HttpMethod.Post, $"{OllamaBaseUrl}/api/chat")
            {
                Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
            };

            HttpResponseMessage? response = null;
            string? connectionError = null;
            try
            {
                response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to connect to Ollama chat endpoint");
                connectionError = $"\n[AI Chat Connection Error: {ex.Message}]";
            }

            if (connectionError != null)
            {
                yield return connectionError;
                yield break;
            }

            if (response == null || !response.IsSuccessStatusCode)
            {
                var code = response?.StatusCode.ToString() ?? "Unknown";
                var errText = response != null ? await response.Content.ReadAsStringAsync(cancellationToken) : "No response";
                yield return $"\n[AI Chat Error: {code} - {errText}]";
                yield break;
            }

            using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var reader = new StreamReader(stream);

            while (!reader.EndOfStream)
            {
                var line = await reader.ReadLineAsync(cancellationToken);
                if (string.IsNullOrEmpty(line)) continue;

                string? chunkText = null;
                try
                {
                    var chunk = JsonSerializer.Deserialize<OllamaChatStreamResponse>(line);
                    chunkText = chunk?.Message?.Content;
                }
                catch
                {
                    // Ignore malformed JSON lines
                }

                if (!string.IsNullOrEmpty(chunkText))
                {
                    yield return chunkText;
                }
            }
        }

        // --- Inner helper classes for JSON deserialization ---

        private class OllamaTagsResponse
        {
            [JsonPropertyName("models")]
            public List<OllamaModelItem>? Models { get; set; }
        }

        private class OllamaModelItem
        {
            [JsonPropertyName("name")]
            public string? Name { get; set; }
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

        private class OllamaChatStreamResponse
        {
            [JsonPropertyName("message")]
            public OllamaChatMessage? Message { get; set; }
        }

        private class OllamaChatMessage
        {
            [JsonPropertyName("content")]
            public string Content { get; set; } = string.Empty;
        }
    }
}
