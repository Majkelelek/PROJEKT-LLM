import { useState, useEffect, useRef } from "react";
import CompatibilityPanel from "./CompatibilityPanel";
import { API_URL } from "../config";

// Komponent panelu testowego (BenchmarkPanel) umożliwiający uruchomienie testu wydajności Ollama z wizualizacją logów w konsoli.
export default function BenchmarkPanel({ ollamaActive, models, onBenchmarkComplete }) {
  // --- Stany konfiguracji testu ---
  const [selectedModel, setSelectedModel] = useState(""); // Wybrany model LLM
  const [complexity, setComplexity] = useState("medium"); // Poziom złożoności testu ("quick", "medium", "complex")

  // --- Stany wykonania testu ---
  const [running, setRunning] = useState(false); // Czy test jest w toku
  const [progress, setProgress] = useState(0); // Procentowy stan postępu testu (0-100)
  const [statusMessage, setStatusMessage] = useState("Skonfiguruj i uruchom testy poniżej."); // Tekst statusowy pod paskiem postępu
  const [consoleLogs, setConsoleLogs] = useState([]); // Logi wypisywane w czarnej konsoli wirtualnej
  const [runResult, setRunResult] = useState(null); // Rezultat ostatnio ukończonego testu

  // Referencja do kontenera logów konsoli
  const consoleEndRef = useRef(null);

  // Domyślny wybór modelu na starcie (preferujemy llama3 jeśli istnieje na liście)
  useEffect(() => {
    if (ollamaActive && models.length > 0 && !selectedModel) {
      const defaultModel = models.find(m => m.includes("llama3")) || models[0];
      setSelectedModel(defaultModel);
    }
  }, [ollamaActive, models, selectedModel]);

  // Efekt automatycznego scrollowania konsoli do najnowszej linii logów
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs]);

  // Funkcja wywołująca asynchronicznie backend i parsująca strumień Server-Sent Events (SSE)
  const runBenchmarks = async () => {
    setRunning(true);
    setProgress(0);
    setRunResult(null);
    setConsoleLogs(["Inicjalizacja testu LLM..."]);
    setStatusMessage("Test wydajności LLM rozpoczęty...");

    try {
      // Wysłanie zapytania POST w celu zainicjowania strumieniowania SSE
      const response = await fetch(`${API_URL}/api/benchmark/run-stream`, {
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
        throw new Error(`Serwer zwrócił kod HTTP ${response.status}`);
      }

      // Odczyt strumienia odpowiedzi HTTP
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // Łączenie odebranego bufora z nowo zdekodowanymi danymi i podział na linie SSE
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // Pozostawienie ewentualnej niepełnej linii na koniec w buforze

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          try {
            // Parsowanie obiektu payload z linii "data: {JSON}"
            const payload = JSON.parse(trimmed.substring(6));

            // Logowanie komunikatów z postępu
            if (payload.message) {
              const isSystem = payload.step.includes("error") || payload.step.includes("warning") || payload.step === "finished";
              setConsoleLogs(prev => [...prev, `${isSystem ? "[SYSTEM]" : "[URUCHAMIACZ]"} ${payload.message}`]);
              setStatusMessage(payload.message);
            }

            // Aktualizacja paska postępu
            if (payload.progress !== undefined) {
              setProgress(payload.progress);
            }

            // Obsługa zakończenia testu i zapisania pełnych danych wynikowych
            if (payload.status === "completed" && payload.run) {
              setRunResult(payload.run);
              onBenchmarkComplete(payload.run);
            }
          } catch (err) {
            console.error("Błąd parsowania linii JSON:", err, trimmed);
          }
        }
      }
    } catch (err) {
      console.error("Uruchomienie benchmarku zakończone niepowodzeniem:", err);
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

        {/* Lewa kolumna: Konfiguracja i wybór modelu */}
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

          {/* Wybór modelu z listy */}
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

          {/* Wybór poziomu złożoności wyjściowej */}
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

          {/* Komunikat ostrzegawczy o wyłączonym Ollama */}
          {!ollamaActive && (
            <div style={{ borderRadius: "6px", padding: "10px", color: "var(--accent-red)", fontSize: "12px", border: "1px solid rgba(251, 113, 133, 0.2)", background: "rgba(251, 113, 133, 0.05)", display: "flex", gap: "8px", alignItems: "center", marginTop: "12px" }}>
              <span className="status-indicator offline" style={{ flexShrink: 0 }}></span>
              <span>⚠️ Ollama jest offline. Uruchom usługę Ollama lokalnie, aby móc przeprowadzić test.</span>
            </div>
          )}

          {/* Przycisk wywołujący test */}
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

        {/* Prawa kolumna: Wirtualna konsola śledzenia logów */}
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
              else if (log.includes("[BŁĄD]")) className += " warning";
              else if (log.includes("sukcesem") || log.includes("zakończony")) className += " success";
              return (
                <div key={idx} className={className}>
                  {log}
                </div>
              );
            })}
            <div ref={consoleEndRef} />
          </div>

          {/* Kontrolki paska postępu */}
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

      {/* Dolna sekcja: Wizualizacja parametrów wynikowych po zakończeniu testu */}
      {runResult && runResult.results?.ollama && !runResult.results.ollama.error && runResult.results.ollama.tokens_per_sec > 0 && (
        <div className="results-card glass-panel">
          <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "20px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Szczegółowe wyniki testu LLM</span>
            <span style={{ fontSize: "14px", color: "var(--accent-green)", fontWeight: "normal" }}>✓ Zakończono</span>
          </h3>

          {/* Tabela metryk — identyczny układ jak /set verbose w CLI Ollama */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", fontFamily: "var(--font-mono)" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-color)" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: "600", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Parametr</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: "600", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Jednostka</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--accent-cyan)", fontWeight: "700", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Wartość</th>
                </tr>
              </thead>
              <tbody>

                {/* ── SEKCJA 1: Ollama verbose (odpowiednik /set verbose) ── */}
                <tr>
                  <td colSpan="3" style={{ padding: "10px 12px 4px", color: "var(--accent-cyan)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", borderTop: "1px solid var(--border-color)", background: "rgba(6, 182, 212, 0.04)" }}>
                    🤖 Ollama — Czasy wnioskowania (verbose)
                  </td>
                </tr>
                <MetricRow
                  label="total duration (Czas całkowity)"
                  description="Całkowity czas od wysłania pytania do zakończenia odpowiedzi."
                  interpretation="less_better"
                  unit="s"
                  value={runResult.results.ollama.total_time_sec}
                />
                <MetricRow
                  label="load duration (Czas ładowania modelu)"
                  description="Czas potrzebny na wczytanie wag modelu LLM do pamięci RAM/VRAM."
                  interpretation="less_better"
                  unit="s"
                  value={runResult.results.ollama.load_duration_sec}
                />
                <MetricRow
                  label="prompt eval count (Tokeny promptu)"
                  description="Liczba tokenów (słów/części słów) w pytaniu wejściowym."
                  interpretation="neutral"
                  unit="token"
                  value={runResult.results.ollama.prompt_eval_count}
                />
                <MetricRow
                  label="prompt eval duration (Czas czytania promptu)"
                  description="Czas spędzony przez model na przetworzenie i zrozumienie pytania."
                  interpretation="less_better"
                  unit="s"
                  value={runResult.results.ollama.prompt_eval_duration_sec}
                />
                <MetricRow
                  label="prompt eval rate (Szybkość czytania pytania)"
                  description="Prędkość przetwarzania tekstu wejściowego (promptu) przez model."
                  interpretation="more_better"
                  unit="token/s"
                  value={runResult.results.ollama.prompt_eval_tokens_per_sec}
                  highlight
                />
                <MetricRow
                  label="eval count (Wygenerowane tokeny)"
                  description="Liczba tokenów wygenerowanych przez model w odpowiedzi."
                  interpretation="neutral"
                  unit="token"
                  value={runResult.results.ollama.tokens_generated}
                />
                <MetricRow
                  label="eval duration (Czas generowania)"
                  description="Czas spędzony przez model na faktycznym generowaniu odpowiedzi token po tokenie."
                  interpretation="less_better"
                  unit="s"
                  value={runResult.results.ollama.eval_duration_sec}
                />
                <MetricRow
                  label="eval rate (Szybkość generowania)"
                  description="Główny wyznacznik wydajności. Prędkość tworzenia nowych tokenów odpowiedzi."
                  interpretation="more_better"
                  unit="token/s"
                  value={runResult.results.ollama.tokens_per_sec}
                  highlight
                />

                {/* ── SEKCJA 2: GPU — nvidia-smi ── */}
                {runResult.results.ollama.gpu_metrics_available && (
                  <>
                    <tr>
                      <td colSpan="3" style={{ padding: "10px 12px 4px", color: "var(--accent-purple, #a78bfa)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", borderTop: "1px solid var(--border-color)", background: "rgba(167, 139, 250, 0.04)" }}>
                        🎮 GPU — nvidia-smi
                      </td>
                    </tr>
                    <MetricRow
                      label="Zużycie VRAM / max VRAM"
                      description="Użyta pamięć karty graficznej do całkowitej dostępnej pamięci."
                      interpretation="neutral"
                      unit="MB"
                      value={`${runResult.results.ollama.gpu_vram_used_mb} / ${runResult.results.ollama.gpu_vram_total_mb}`}
                    />
                    <MetricRow
                      label="Obciążenie GPU"
                      description="Wykorzystanie rdzeni procesora karty graficznej podczas testu (powinno być wysokie przy akceleracji)."
                      interpretation="more_better"
                      unit="%"
                      value={runResult.results.ollama.gpu_util_percent}
                    />
                    <MetricRow
                      label="Pobór mocy / limit mocy"
                      description="Chwilowy pobór prądu przez kartę w stosunku do limitu TDP."
                      interpretation="neutral"
                      unit="W"
                      value={`${runResult.results.ollama.gpu_power_draw_w} / ${runResult.results.ollama.gpu_power_limit_w}`}
                    />
                    <MetricRow
                      label="Temperatura GPU"
                      description="Temperatura rdzenia karty graficznej pod obciążeniem."
                      interpretation="less_better"
                      unit="°C"
                      value={runResult.results.ollama.gpu_temp_c}
                    />
                  </>
                )}
                {!runResult.results.ollama.gpu_metrics_available && (
                  <tr>
                    <td colSpan="3" style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: "12px", borderTop: "1px solid var(--border-color)", fontStyle: "italic" }}>
                      🎮 GPU (nvidia-smi) — niedostępne (brak karty NVIDIA lub sterowników)
                    </td>
                  </tr>
                )}

                {/* ── SEKCJA 3: System — RAM i CPU ── */}
                <tr>
                  <td colSpan="3" style={{ padding: "10px 12px 4px", color: "var(--accent-green)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", borderTop: "1px solid var(--border-color)", background: "rgba(74, 222, 128, 0.04)" }}>
                    💻 System — RAM i CPU (próbka po teście)
                  </td>
                </tr>
                <MetricRow
                  label="Zużycie RAM / całkowity RAM"
                  description="Pamięć operacyjna komputera zajęta przez system i procesy."
                  interpretation="less_better"
                  unit="GB"
                  value={`${runResult.results.ollama.sys_ram_used_gb} / ${runResult.results.ollama.sys_ram_total_gb} (${runResult.results.ollama.sys_ram_percent}%)`}
                />
                <MetricRow
                  label="Obciążenie procesora (CPU)"
                  description="Średnie wykorzystanie rdzeni głównego procesora komputera."
                  interpretation="less_better"
                  unit="%"
                  value={runResult.results.ollama.sys_cpu_percent}
                />

              </tbody>
            </table>
          </div>

          {/* Analiza pamięciowa za pomocą panelu kompatybilności */}
          <div style={{ marginTop: "30px", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
            <h4 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "16px", color: "var(--accent-cyan)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Analiza wykorzystania pamięci i warstw modelu
            </h4>
            <CompatibilityPanel
              specs={runResult.specs}
              fixedModelName={runResult.results.ollama.model}
              fixedModelDetails={{
                parameter_size: runResult.results.ollama.parameter_size,
                quantization_level: runResult.results.ollama.quantization_level,
                family: runResult.results.ollama.family
              }}
              hideSelectors={true}
              actualTps={runResult.results.ollama.tokens_per_sec}
            />
          </div>

          {/* Wygenerowana odpowiedź próbna */}
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

// Komponent pomocniczy: pojedynczy wiersz tabeli metryk
function MetricRow({ label, description, interpretation, unit, value, highlight }) {
  let interpText = "";
  let interpColor = "var(--text-muted)";

  if (interpretation === "less_better") {
    interpText = " (Im mniej, tym lepiej ⬇️)";
    interpColor = "var(--accent-red)";
  } else if (interpretation === "more_better") {
    interpText = " (Im więcej, tym lepiej ⬆️)";
    interpColor = "var(--accent-green)";
  } else if (interpretation === "neutral") {
    interpText = " (Zależy od konfiguracji ➔)";
    interpColor = "var(--text-muted)";
  }

  return (
    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: "13px" }}>
        <div style={{ fontWeight: "600", color: "var(--text-primary)" }}>{label}</div>
        {description && (
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px", fontFamily: "var(--font-sans)", lineHeight: "1.4" }}>
            {description}
            {interpText && <span style={{ color: interpColor, fontWeight: "500", marginLeft: "4px" }}>{interpText}</span>}
          </div>
        )}
      </td>
      <td style={{ padding: "10px 12px", color: "var(--text-muted)", textAlign: "center", fontSize: "12px", verticalAlign: "middle" }}>{unit}</td>
      <td style={{
        padding: "10px 12px",
        textAlign: "right",
        fontWeight: highlight ? "700" : "500",
        color: highlight ? "var(--accent-cyan)" : "var(--text-primary)",
        fontSize: "14px",
        verticalAlign: "middle"
      }}>
        {value ?? "—"}
      </td>
    </tr>
  );
}
