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
using NeuroBench.Backend.Models;
using NeuroBench.Backend.Services;

var builder = WebApplication.CreateBuilder(args);

// Configure Kestrel to listen on 127.0.0.1:8000 to match Python FastAPI backend
builder.WebHost.UseUrls("http://127.0.0.1:8000");

// Configure logging
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

// Add services
builder.Services.AddSingleton<SystemInfoService>();
builder.Services.AddHttpClient<OllamaClientService>();

// Configure CORS
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

// Enable CORS
app.UseCors("AllowAll");

// --- API Endpoints ---

// 1. GET /api/system-info: Get full static specs and current live metrics
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
        app.Logger.LogError(ex, "Error fetching system information");
        return Results.Problem(ex.Message, statusCode: 500);
    }
});

// 2. GET /api/system-info/live: Get current live CPU/RAM metrics only
app.MapGet("/api/system-info/live", (SystemInfoService sysInfo) =>
{
    try
    {
        var live = sysInfo.GetDynamicMetrics();
        return Results.Ok(live);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error fetching live metrics");
        return Results.Problem(ex.Message, statusCode: 500);
    }
});

// 3. GET /api/models: Check if Ollama is running and fetch list of models
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

// 4. POST /api/benchmark/run-stream: Run LLM benchmark and stream progress/results via SSE
app.MapPost("/api/benchmark/run-stream", async (
    HttpContext context,
    RunBenchmarkRequest request,
    OllamaClientService ollama,
    SystemInfoService sysInfo) =>
{
    context.Response.ContentType = "text/event-stream";
    context.Response.Headers.Append("Cache-Control", "no-cache");
    context.Response.Headers.Append("Connection", "keep-alive");
    await context.Response.Body.FlushAsync();

    using var writer = new StreamWriter(context.Response.Body);

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
        await writer.WriteAsync($"data: {json}\n\n");
        await writer.FlushAsync();
    }

    try
    {
        var specs = sysInfo.GetStaticSpecs();
        var results = new BenchmarkResults();

        // Step 1: Run inference benchmark on Selected Model
        if (!string.IsNullOrEmpty(request.Model))
        {
            await SendSseEvent("ollama", $"Uruchamianie testu wnioskowania LLM Ollama z modelem [{request.Model}]...", 20);
            await Task.Delay(100);

            bool ollamaActive = await ollama.IsOllamaRunningAsync();
            if (ollamaActive)
            {
                try
                {
                    var ollamaRes = await ollama.RunLlmBenchmarkAsync(request.Model, request.Complexity);
                    results.Ollama = ollamaRes;
                }
                catch (Exception ex)
                {
                    app.Logger.LogError(ex, "Ollama inference benchmark failed");
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
                    Error = "Ollama is not running.",
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
                Error = "No model selected",
                Model = "",
                TokensPerSec = 0,
                LatencySec = 0
            };
        }

        // Step 2: Generate AI analysis report
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
                app.Logger.LogError(ex, "AI Report generation failed");
                aiReport = $"### Ocena Wydajności Wnioskowania AI\n\nBłąd podczas generowania raportu przez Ollama: {ex.Message}\n\nSpecyfikacja:\n- CPU: {specs.CpuModel}\n- RAM: {specs.RamTotalGb} GB\n- GPU: {string.Join(", ", specs.Gpus)}";
            }
        }
        else
        {
            aiReport = "### Ocena Wydajności Wnioskowania AI\n\nRaport analizy AI został pominięty. Upewnij się, że Ollama działa i wybrano model, aby wygenerować szczegółowe analizy AI.";
        }

        // Prepare final run data
        var finalRunData = new BenchmarkRun
        {
            Id = Guid.NewGuid().ToString(),
            Timestamp = DateTime.Now.ToString("o"),
            Specs = specs,
            Results = results,
            AiReport = aiReport,
            SelectedModel = request.Model ?? "None",
            Complexity = request.Complexity
        };

        // Completion SSE message
        await SendSseEvent("finished", "Test zakończony sukcesem!", 100, "completed", finalRunData);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error running benchmark stream session");
        try
        {
            await SendSseEvent("error", $"Błąd podczas wykonywania testu: {ex.Message}", 100, "error");
        }
        catch { }
    }
});



// 8. POST /api/chat: Hardware expert assistant chat room (text streaming)
app.MapPost("/api/chat", async (HttpContext context, ChatRequest request, OllamaClientService ollama) =>
{
    bool ollamaActive = await ollama.IsOllamaRunningAsync();
    if (!ollamaActive)
    {
        context.Response.StatusCode = 503;
        await context.Response.WriteAsJsonAsync(new { detail = "Usługa Ollama nie działa lokalnie." });
        return;
    }

    context.Response.ContentType = "text/plain";
    
    try
    {
        await foreach (var chunk in ollama.StreamChatResponseAsync(request.Model, request.Specs, request.Results, request.History))
        {
            await context.Response.WriteAsync(chunk);
            await context.Response.Body.FlushAsync();
        }
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Chat streaming session failed");
        await context.Response.WriteAsync($"\n[AI Chat Error: {ex.Message}]");
    }
});

app.Run();
