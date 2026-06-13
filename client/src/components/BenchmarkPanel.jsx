import React, { useState, useEffect, useRef } from "react";
import CompatibilityPanel from "./CompatibilityPanel";

export default function BenchmarkPanel({ ollamaActive, models, onBenchmarkComplete }) {
  // Nazwa wybranego modelu z listy rozwijanej
  const [selectedModel, setSelectedModel] = useState("");
  const [complexity, setComplexity] = useState("medium"); // "quick", "medium", "complex"
  
  // Stany powiązane z procesem uruchomienia testu wydajności
  const [running, setRunning] = useState(false);               // Czy benchmark aktualnie trwa
  const [progress, setProgress] = useState(0);                 // Postęp testu (0-100%)
  const [statusMessage, setStatusMessage] = useState("Configure and run benchmarks below."); // Status u dołu konsoli
  const [consoleLogs, setConsoleLogs] = useState([]);          // Tablica przechowująca linie wypisywane w wirtualnym terminalu
  const [runResult, setRunResult] = useState(null);            // Ostatnio zapisane wyniki i wygenerowany raport
  
  // Referencja do automatycznego scrollowania konsoli na dół
  const consoleEndRef = useRef(null);

  // Efekt ustawiający domyślny model po załadowaniu listy z backendu
  useEffect(() => {
    if (ollamaActive && models.length > 0 && !selectedModel) {
      // Domyślnie preferujemy rodzinę modeli llama3, jeśli jest pobrana, w przeciwnym wypadku pierwszy z listy
      const defaultModel = models.find(m => m.includes("llama3")) || models[0];
      setSelectedModel(defaultModel);
    }
  }, [ollamaActive, models]);

  // Efekt wymuszający przewinięcie widoku konsoli po dodaniu nowej linii logu
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs]);

  // Funkcja wywołująca benchmark i przetwarzająca strumieniową odpowiedź SSE z backendu
  const runBenchmarks = async () => {
    setRunning(true);
    setProgress(0);
    setRunResult(null);
    setConsoleLogs(["[SYSTEM] Inicjalizacja testu LLM..."]);
    setStatusMessage("Test wydajności LLM rozpoczęty...");

    try {
      // Wywołanie endpointu POST zwracającego strumień EventStream
      const response = await fetch("http://127.0.0.1:8000/api/benchmark/run-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: selectedModel,
          tests: ["ollama"],
          complexity: complexity
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      // Odczytywanie strumienia danych binarnych
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // Dekodowanie kawałka danych i dzielenie na kompletne linie wg specyfikacji SSE (\n\n)
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        // Przetrzymujemy ewentualną niedokończoną linię w buforze
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          try {
            // Parsowanie właściwego obiektu JSON przesyłanego w zdarzeniu
            const payload = JSON.parse(trimmed.substring(6));
            
            // Wypisywanie wiadomości diagnostycznych do konsoli deweloperskiej w UI
            if (payload.message) {
              const isSystem = payload.step.includes("error") || payload.step.includes("warning") || payload.step === "finished";
              setConsoleLogs(prev => [...prev, `${isSystem ? "[SYSTEM]" : "[RUNNER]"} ${payload.message}`]);
              setStatusMessage(payload.message);
            }

            // Aktualizacja paska postępu
            if (payload.progress !== undefined) {
              setProgress(payload.progress);
            }

            // Zapisanie finalnego wyniku po pomyślnym zakończeniu strumieniowania
            if (payload.status === "completed" && payload.run) {
              setRunResult(payload.run);
              onBenchmarkComplete(payload.run);
            }
          } catch (err) {
            console.error("Error parsing JSON line:", err, trimmed);
          }
        }
      }
    } catch (err) {
      console.error("Benchmarking failed:", err);
      setConsoleLogs(prev => [...prev, `[BŁĄD] Wykonanie testów nie powiodło się: ${err.message}`]);
      setStatusMessage("Błąd podczas wykonywania testów.");
      setProgress(100);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
      
      <div className="benchmark-layout">
        
        {/* Lewy panel boczny: Konfiguracja i wybór modelu */}
        <div className="benchmark-controls-card glass-panel">
          <h3 style={{ fontSize: "18px", fontWeight: "700", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
            Konfiguracja testu LLM
          </h3>
          
          <div className="control-group">
            <span className="control-label">Wybrany test</span>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
              🤖 Test LLM Ollama
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
              Mierzy opóźnienie (TTFT) oraz prędkość generowania tokenów na sekundę.
            </div>
          </div>

          {/* Lista rozwijana z dostępnymi modelami Ollama */}
          {ollamaActive && (
            <div className="control-group">
              <label className="control-label" htmlFor="model-select">Docelowy model LLM</label>
              <select
                id="model-select"
                className="select-input"
                value={selectedModel}
                disabled={running}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Wybór złożoności pytania / testu */}
          <div className="control-group" style={{ marginTop: "12px" }}>
            <label className="control-label" htmlFor="complexity-select">Złożoność pytania / testu</label>
            <select
              id="complexity-select"
              className="select-input"
              value={complexity}
              disabled={running}
              onChange={(e) => setComplexity(e.target.value)}
            >
              <option value="quick">Szybkie (krótkie pytania, minimalny raport)</option>
              <option value="medium">Średnie (ogólne testy, standardowy raport)</option>
              <option value="complex">Złożone (głębokie artykuły, pełny raport)</option>
            </select>
          </div>

          {/* Ostrzeżenie jeśli Ollama jest offline */}
          {!ollamaActive && (
            <div style={{ borderRadius: "6px", padding: "10px", color: "var(--accent-red)", fontSize: "12px", border: "1px solid rgba(251, 113, 133, 0.2)", background: "rgba(251, 113, 133, 0.05)", display: "flex", gap: "8px", alignItems: "center", marginTop: "12px" }}>
              <span className="status-indicator offline" style={{ flexShrink: 0 }}></span>
              <span>⚠️ Ollama jest offline. Uruchom usługę Ollama lokalnie, aby móc przeprowadzić test.</span>
            </div>
          )}

          {/* Przycisk startu */}
          <button
            className="run-btn"
            onClick={runBenchmarks}
            disabled={running || !ollamaActive || !selectedModel}
          >
            {running ? (
              <>
                <span className="spinner"></span> Uruchamianie testu...
              </>
            ) : (
              "🚀 Uruchom test LLM"
            )}
          </button>
        </div>

        {/* Prawy panel: Wirtualna konsola z postępem */}
        <div className="console-card glass-panel" style={{ flexGrow: 1 }}>
          <div className="console-title">
            <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", background: running ? "var(--accent-green)" : "var(--text-muted)", animation: running ? "spin 2s linear infinite" : "none" }}></span>
            <span>Monitor wykonania w konsoli</span>
          </div>

          <div className="console-box">
            {consoleLogs.length === 0 && (
              <span className="console-line system">[BEZCZYNNOŚĆ] Oczekiwanie na start... Wybierz testy po lewej stronie i uruchom.</span>
            )}
            {consoleLogs.map((log, idx) => {
              let className = "console-line";
              if (log.includes("[SYSTEM]")) className += " system";
              else if (log.includes("[ERROR]")) className += " warning";
              else if (log.includes("complete") || log.includes("successfully")) className += " success";
              return (
                <div key={idx} className={className}>
                  {log}
                </div>
              );
            })}
            <div ref={consoleEndRef} />
          </div>

          {/* Pasek postępu procentowego */}
          <div className="progress-container">
            <div className="progress-header">
              <span>{statusMessage}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: "bold" }}>{progress}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        </div>

      </div>

      {/* Dolna sekcja: Wizualizacja parametrów wynikowych testu LLM */}
      {runResult && runResult.results?.ollama && !runResult.results.ollama.error && runResult.results.ollama.tokens_per_sec > 0 && (
        <div className="results-card glass-panel">
          <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "20px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Wyniki testu LLM</span>
            <span style={{ fontSize: "14px", color: "var(--accent-green)", fontWeight: "normal" }}>✓ Zakończono</span>
          </h3>

          <div className="results-grid" style={{ gridTemplateColumns: "1fr" }}>
            {/* Karta testu Ollama */}
            <div className="result-metric-card">
              <div className="metric-header">
                <span className="metric-header-title">🤖 Test LLM</span>
                <span className="text-green" style={{ fontSize: "12px" }}>Zakończony pomyślnie</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Model wnioskowania</span>
                <span className="metric-value" style={{ fontSize: "12px" }}>{runResult.results.ollama.model}</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Szybkość generowania</span>
                <span className="metric-value metric-highlight">{runResult.results.ollama.tokens_per_sec} t/s</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Szybkość oceny promptu</span>
                <span className="metric-value">{runResult.results.ollama.prompt_eval_tokens_per_sec} t/s</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">Opóźnienie odpowiedzi (TTFT)</span>
                <span className="metric-value">{runResult.results.ollama.latency_sec}s</span>
              </div>
              <div className="metric-row" style={{ borderTop: "1px dashed rgba(255,255,255,0.05)", paddingTop: "8px", marginTop: "4px" }}>
                <span className="metric-label">Wygenerowane tokeny</span>
                <span className="metric-value">{runResult.results.ollama.tokens_generated} tokenów</span>
              </div>
            </div>
          </div>

          {/* Analiza alokacji warstw i kompatybilności dla przetestowanego modelu */}
          <div style={{ marginTop: "30px", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
            <h4 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "16px", color: "var(--accent-cyan)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Analiza wykorzystania pamięci i warstw modelu
            </h4>
            <CompatibilityPanel 
              specs={runResult.specs} 
              fixedModelName={runResult.results.ollama.model}
              hideSelectors={true}
              actualTps={runResult.results.ollama.tokens_per_sec}
            />
          </div>

          {/* Wygenerowana odpowiedź testowa */}
          {runResult.results.ollama.response && (
            <div style={{ marginTop: "30px", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
              <h4 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "12px", color: "var(--accent-cyan)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Wygenerowana odpowiedź testowa
              </h4>
              <div style={{ 
                padding: "16px", 
                backgroundColor: "rgba(0, 0, 0, 0.25)", 
                border: "1px solid var(--border-color)", 
                borderRadius: "6px",
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                lineHeight: "1.6",
                color: "#e4e4e7",
                whiteSpace: "pre-wrap",
                maxHeight: "250px",
                overflowY: "auto"
              }}>
                {runResult.results.ollama.response}
              </div>
            </div>
          )}
          
        </div>
      )}

    </div>
  );
}
