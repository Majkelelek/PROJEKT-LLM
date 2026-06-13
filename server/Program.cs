using System;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ProjektAI.Backend.Models;
using ProjektAI.Backend.Services;

var builder = WebApplication.CreateBuilder(args);

// Konfiguracja Kestrel (wbudowany serwer HTTP), aby nasłuchiwał na adresie 127.0.0.1:8000
builder.WebHost.UseUrls("http://127.0.0.1:8000");

// Konfiguracja dostawców logów (wyczyszczenie domyślnych i dodanie logowania w konsoli)
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

// Rejestracja usług w kontenerze wstrzykiwania zależności (Dependency Injection)
builder.Services.AddSingleton<SystemInfoService>();
builder.Services.AddHttpClient<OllamaClientService>();

// Konfiguracja polityki CORS (Cross-Origin Resource Sharing) dopuszczającej zapytania z dowolnego źródła
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Włączenie polityki CORS w potoku przetwarzania żądań HTTP
app.UseCors("AllowAll");

// --- Punkty końcowe API (Endpoints) ---

// 1. GET /api/system-info: Zwraca pełną statyczną specyfikację sprzętową oraz aktualne metryki dynamiczne (zużycie CPU, RAM)
app.MapGet("/api/system-info", (SystemInfoService sysInfo) =>
{
    try
    {
        var specs = sysInfo.GetStaticSpecs();
        var live = sysInfo.GetDynamicMetrics();
        return Results.Ok(new
        {
            specs = specs,
            live_metrics = live
        });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Błąd podczas pobierania informacji o systemie");
        return Results.Problem(ex.Message, statusCode: 500);
    }
});

// 2. GET /api/system-info/live: Zwraca wyłącznie aktualne, dynamiczne metryki zużycia CPU i pamięci RAM
app.MapGet("/api/system-info/live", (SystemInfoService sysInfo) =>
{
    try
    {
        var live = sysInfo.GetDynamicMetrics();
        return Results.Ok(live);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Błąd podczas pobierania metryk na żywo");
        return Results.Problem(ex.Message, statusCode: 500);
    }
});

// 3. GET /api/models: Sprawdza czy usługa Ollama jest aktywna oraz pobiera listę zainstalowanych modeli lokalnych
app.MapGet("/api/models", async (OllamaClientService ollama) =>
{
    bool isRunning = await ollama.IsOllamaRunningAsync();
    if (!isRunning)
    {
        return Results.Ok(new
        {
            ollama_active = false,
            models = Array.Empty<string>()
        });
    }

    var models = await ollama.GetOllamaModelsAsync();
    return Results.Ok(new
    {
        ollama_active = true,
        models = models
    });
});

// 4. POST /api/benchmark/run-stream: Uruchamia benchmark LLM i przesyła postęp oraz wyniki za pomocą strumienia Server-Sent Events (SSE)
app.MapPost("/api/benchmark/run-stream", async (
    HttpContext context,
    RunBenchmarkRequest request,
    OllamaClientService ollama,
    SystemInfoService sysInfo) =>
{
    // Ustawienie odpowiednich nagłówków HTTP dla transmisji SSE
    // X-Accel-Buffering: no wyłącza buforowanie odpowiedzi przez Kestrel i ewentualne proxy (nginx)
    context.Response.ContentType = "text/event-stream";
    context.Response.Headers.Append("Cache-Control", "no-cache");
    context.Response.Headers.Append("Connection", "keep-alive");
    context.Response.Headers.Append("X-Accel-Buffering", "no");

    // Pomocnicza funkcja asynchroniczna do wysyłania zdarzeń w formacie SSE do klienta.
    // WAŻNE: Piszemy bezpośrednio przez context.Response.WriteAsync, a NIE przez StreamWriter,
    // ponieważ StreamWriter z blokiem "using" dispose'uje strumień odpowiedzi HTTP zbyt wcześnie,
    // co powoduje błąd ERR_INCOMPLETE_CHUNKED_ENCODING w przeglądarce.
    async Task SendSseEvent(string step, string message, int progress, string status = "running", object? run = null)
    {
        var payload = new
        {
            status,
            step,
            message,
            progress,
            run
        };
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        });
        await context.Response.WriteAsync($"data: {json}\n\n");
        await context.Response.Body.FlushAsync();
    }

    try
    {
        var specs = sysInfo.GetStaticSpecs();
        var results = new BenchmarkResults();

        // Krok 1: Uruchomienie testu wnioskowania (Inference Benchmark) na wybranym modelu
        if (!string.IsNullOrEmpty(request.Model))
        {
            await SendSseEvent("ollama", $"Uruchamianie testu wnioskowania LLM Ollama z modelem [{request.Model}]...", 20);
            await Task.Delay(100);

            bool ollamaActive = await ollama.IsOllamaRunningAsync();
            if (ollamaActive)
            {
                try
                {
                    var ollamaRes = await ollama.RunLlmBenchmarkAsync(request.Model, request.Complexity, sysInfo);
                    results.Ollama = ollamaRes;
                }
                catch (Exception ex)
                {
                    app.Logger.LogError(ex, "Błąd testu wydajności Ollama");
                    results.Ollama = new OllamaResult
                    {
                        Error = ex.Message,
                        Model = request.Model,
                        TokensPerSec = 0,
                        LatencySec = 0
                    };
                    await SendSseEvent("ollama_error", $"Błąd wnioskowania Ollama: {ex.Message}", 50);
                }
            }
            else
            {
                results.Ollama = new OllamaResult
                {
                    Error = "Usługa Ollama nie jest uruchomiona.",
                    Model = request.Model,
                    TokensPerSec = 0,
                    LatencySec = 0
                };
                await SendSseEvent("ollama_warning", "Pomijanie testu Ollama (API Ollama jest wyłączone).", 50);
            }
        }
        else
        {
            results.Ollama = new OllamaResult
            {
                Error = "Nie wybrano żadnego modelu",
                Model = "",
                TokensPerSec = 0,
                LatencySec = 0
            };
        }

        // Krok 2: Generowanie raportu analizy wydajności przez sztuczną inteligencję (AI)
        string aiReport = "";
        bool ollamaRunningForReport = await ollama.IsOllamaRunningAsync();
        if (!string.IsNullOrEmpty(request.Model) && ollamaRunningForReport)
        {
            await SendSseEvent("report", "Generowanie eksperckiego raportu wydajności AI przez Ollama...", 70);
            await Task.Delay(100);
            try
            {
                aiReport = await ollama.GenerateAiReportAsync(specs, results, request.Model, request.Complexity);
            }
            catch (Exception ex)
            {
                app.Logger.LogError(ex, "Generowanie raportu AI zakończone niepowodzeniem");
                aiReport = $"### Ocena Wydajności Wnioskowania AI\n\nBłąd podczas generowania raportu przez Ollama: {ex.Message}\n\nSpecyfikacja:\n- CPU: {specs.CpuModel}\n- RAM: {specs.RamTotalGb} GB\n- GPU: {string.Join(", ", specs.Gpus)}";
            }
        }
        else
        {
            aiReport = "### Ocena Wydajności Wnioskowania AI\n\nRaport analizy AI został pominięty. Upewnij się, że Ollama działa i wybrano model, aby wygenerować szczegółowe analizy AI.";
        }

        // Przygotowanie końcowych danych z przebiegu testu
        var finalRunData = new BenchmarkRun
        {
            Id = Guid.NewGuid().ToString(),
            Timestamp = DateTime.Now.ToString("o"),
            Specs = specs,
            Results = results,
            AiReport = aiReport,
            SelectedModel = request.Model ?? "Brak",
            Complexity = request.Complexity
        };

        // Wysłanie wiadomości o pomyślnym ukończeniu testu w SSE
        await SendSseEvent("finished", "Test zakończony sukcesem!", 100, "completed", finalRunData);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Błąd podczas sesji strumieniowania testów");
        try
        {
            await SendSseEvent("error", $"Błąd podczas wykonywania testu: {ex.Message}", 100, "error");
        }
        catch { }
    }
});

// Uruchomienie aplikacji webowej i nasłuchiwanie na żądania HTTP
app.Run();
