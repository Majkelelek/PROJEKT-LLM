import { useState } from "react";
import CompatibilityPanel from "./CompatibilityPanel";

// Pomocnicza funkcja do wyboru głównej/najsilniejszej karty GPU
function getBestGpu(specs) {
  const details = specs?.gpu_details || [];
  if (details.length === 0) {
    if (specs?.gpus && specs.gpus.length > 0) {
      return { name: specs.gpus[0], vram_gb: 0.5 };
    }
    return { name: "Brak / Tylko CPU", vram_gb: 0.0 };
  }

  return details.reduce((best, curr) => {
    return curr.vram_gb > best.vram_gb ? curr : best;
  }, { name: "Nieznana karta graficzna", vram_gb: 0.0 });
}

export default function ComparePanel() {
  const [history] = useState(() => {
    try {
      const localData = localStorage.getItem("projekt_ai_history");
      if (localData) {
        const parsed = JSON.parse(localData);
        
        // Zabezpieczenie dla starych wpisów przed problemami z pustym/nieunikalnym kluczem
        const sanitized = parsed.map((run, idx) => ({
          ...run,
          id: run.id || run.Id || `run-legacy-${idx}-${new Date(run.timestamp || Date.now()).getTime()}`,
          complexity: run.complexity || "medium"
        }));

        // Sortowanie od najnowszego
        return sanitized.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      }
    } catch (e) {
      console.error("Błąd wczytywania historii w panelu porównawczym:", e);
    }
    return [];
  });

  const [runAId, setRunAId] = useState(() => {
    return history.length > 0 ? history[0].id : "";
  });

  const [runBId, setRunBId] = useState(() => {
    return history.length > 1 ? history[1].id : (history.length > 0 ? history[0].id : "");
  });

  const runA = history.find((r) => r.id === runAId) || null;
  const runB = history.find((r) => r.id === runBId) || null;

  // Obliczanie różnicy wydajności w t/s
  const tpsA = runA?.results?.ollama?.tokens_per_sec || 0;
  const tpsB = runB?.results?.ollama?.tokens_per_sec || 0;
  let percentDiff = 0;
  let winner = null;

  if (tpsA > 0 && tpsB > 0) {
    if (tpsA > tpsB) {
      percentDiff = Math.round(((tpsA - tpsB) / tpsB) * 100);
      winner = "A";
    } else if (tpsB > tpsA) {
      percentDiff = Math.round(((tpsB - tpsA) / tpsA) * 100);
      winner = "B";
    }
  }

  if (history.length < 2) {
    return (
      <div className="glass-panel empty-state" style={{ padding: "40px", textAlign: "center" }}>
        <div className="empty-icon" style={{ fontSize: "48px", marginBottom: "16px" }}>⚖️</div>
        <h2>Brak wystarczającej liczby testów</h2>
        <p style={{ marginTop: "8px", color: "var(--text-secondary)" }}>
          Musisz uruchomić przynajmniej <strong>2 testy wydajnościowe</strong> w zakładce „Uruchom testy”, aby móc porównać modele.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Nagłówek i selektory porównania */}
      <div className="glass-panel" style={{ padding: "20px 24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "800", marginBottom: "16px", background: "linear-gradient(to right, #fff, var(--accent-cyan))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Porównanie wydajności modeli LLM
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {/* Wybór modelu A */}
          <div className="control-group">
            <label className="control-label" htmlFor="compare-select-a">Wybierz Model A (Lewa strona)</label>
            <select
              id="compare-select-a"
              className="select-input"
              value={runAId}
              onChange={(e) => setRunAId(e.target.value)}
            >
              {history.map((run) => (
                <option key={run.id} value={run.id}>
                  [{run.complexity === "quick" ? "Szybki" : run.complexity === "complex" ? "Zaawansowany" : "Średni"}] {run.results?.ollama?.model || run.selected_model} — {run.results?.ollama?.tokens_per_sec || 0} t/s ({new Date(run.timestamp).toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          {/* Wybór modelu B */}
          <div className="control-group">
            <label className="control-label" htmlFor="compare-select-b">Wybierz Model B (Prawa strona)</label>
            <select
              id="compare-select-b"
              className="select-input"
              value={runBId}
              onChange={(e) => setRunBId(e.target.value)}
            >
              {history.map((run) => (
                <option key={run.id} value={run.id}>
                  [{run.complexity === "quick" ? "Szybki" : run.complexity === "complex" ? "Zaawansowany" : "Średni"}] {run.results?.ollama?.model || run.selected_model} — {run.results?.ollama?.tokens_per_sec || 0} t/s ({new Date(run.timestamp).toLocaleString()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Panele porównawcze side-by-side */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))",
        gap: "24px"
      }}>

        {/* KOLUMNA A */}
        {runA && (
          <div className="glass-panel" style={{ padding: "24px", borderTop: "4px solid var(--accent-cyan)" }}>
            {/* Nagłówek modelu A */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--accent-cyan)", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Model A
                </span>
                <h3 style={{ fontSize: "20px", fontWeight: "800", marginTop: "2px" }}>
                  {runA.results?.ollama?.model || runA.selected_model}
                </h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>
                  Data testu: {new Date(runA.timestamp).toLocaleString()}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>
                  Trudność: <strong style={{ color: "var(--accent-amber)" }}>
                    {runA.complexity === "quick" ? "Szybki" : runA.complexity === "complex" ? "Zaawansowany" : "Średni"}
                  </strong>
                </span>
              </div>

              {/* Plakietka porównawcza */}
              {winner === "A" && percentDiff > 0 && (
                <span style={{ backgroundColor: "rgba(0, 230, 118, 0.15)", color: "var(--accent-green)", fontSize: "12px", fontWeight: "700", padding: "6px 12px", borderRadius: "20px", border: "1px solid rgba(0, 230, 118, 0.3)" }}>
                  🏆 Szybszy o {percentDiff}%
                </span>
              )}
              {winner === "A" && percentDiff === 0 && (
                <span style={{ backgroundColor: "rgba(255, 235, 59, 0.1)", color: "var(--accent-amber)", fontSize: "12px", fontWeight: "700", padding: "6px 12px", borderRadius: "20px", border: "1px solid rgba(255, 235, 59, 0.2)" }}>
                  ⚖️ Remis
                </span>
              )}
              {winner === "B" && percentDiff > 0 && (
                <span style={{ backgroundColor: "rgba(255, 23, 68, 0.1)", color: "var(--accent-red)", fontSize: "12px", fontWeight: "700", padding: "6px 12px", borderRadius: "20px", border: "1px solid rgba(255, 23, 68, 0.2)" }}>
                  🐢 Wolniejszy
                </span>
              )}
            </div>

            {/* Skrócona specyfikacja platformy testowej */}
            <div style={{ background: "rgba(0,0,0,0.15)", padding: "10px 14px", borderRadius: "6px", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "20px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <span>CPU: <strong>{runA.specs?.cpu_model?.split(" @")[0] || "CPU"}</strong></span>
              <span>GPU: <strong>{getBestGpu(runA.specs).name}</strong></span>
              <span>VRAM: <strong>{getBestGpu(runA.specs).vram_gb} GB</strong></span>
            </div>

            {/* Metryki liczbowe */}
            <h4 style={{ fontSize: "14px", fontWeight: "800", color: "var(--accent-cyan)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
              Wyniki pomiarów wydajności
            </h4>
            <div style={{ overflowX: "auto", marginBottom: "30px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--text-secondary)" }}>Parametr</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--accent-cyan)" }}>Wartość</th>
                  </tr>
                </thead>
                <tbody>
                  {runA.results?.ollama && (
                    <>
                      <MetricRowShort label="Szybkość generowania" unit="token/s" value={runA.results.ollama.tokens_per_sec} highlight />
                      <MetricRowShort label="Czas całkowity" unit="s" value={runA.results.ollama.total_time_sec} />
                      <MetricRowShort label="Czas ładowania modelu" unit="s" value={runA.results.ollama.load_duration_sec} />
                      <MetricRowShort label="Opóźnienie (TTFT)" unit="s" value={runA.results.ollama.latency_sec} />
                      <MetricRowShort label="Wygenerowane tokeny" unit="token" value={runA.results.ollama.tokens_generated} />
                      <MetricRowShort label="Szybkość czytania pytania" unit="token/s" value={runA.results.ollama.prompt_eval_tokens_per_sec} />

                      {runA.results.ollama.gpu_metrics_available ? (
                        <>
                          <MetricRowShort label="Średnie zużycie VRAM" unit="MB" value={runA.results.ollama.gpu_vram_used_mb} />
                          <MetricRowShort label="Obciążenie GPU" unit="%" value={runA.results.ollama.gpu_util_percent} />
                          <MetricRowShort label="Temperatura GPU" unit="°C" value={runA.results.ollama.gpu_temp_c} />
                        </>
                      ) : (
                        <tr>
                          <td colSpan="2" style={{ padding: "6px 8px", color: "var(--text-muted)", fontStyle: "italic" }}>
                            GPU (nvidia-smi) — niedostępne
                          </td>
                        </tr>
                      )}

                      <MetricRowShort label="Średnie obciążenie CPU" unit="%" value={runA.results.ollama.sys_cpu_percent} />
                      <MetricRowShort label="Średnie zużycie RAM" unit="%" value={runA.results.ollama.sys_ram_percent} />
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Kompatybilność i offload */}
            <h4 style={{ fontSize: "14px", fontWeight: "800", color: "var(--accent-cyan)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "16px" }}>
              Analiza alokacji pamięci i warstw
            </h4>
            <div style={{ marginBottom: "30px" }}>
              <CompatibilityPanel
                specs={runA.specs}
                fixedModelName={runA.results?.ollama?.model || runA.selected_model}
                fixedModelDetails={{
                  parameter_size: runA.results?.ollama?.parameter_size,
                  quantization_level: runA.results?.ollama?.quantization_level,
                  family: runA.results?.ollama?.family,
                  model_size_bytes: runA.results?.ollama?.model_size_bytes,
                  model_size_vram_bytes: runA.results?.ollama?.model_size_vram_bytes
                }}
                hideSelectors={true}
                actualTps={runA.results?.ollama?.tokens_per_sec}
              />
            </div>

            {/* Wygenerowana odpowiedź testowa */}
            {runA.results?.ollama?.response && (
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: "800", color: "var(--accent-cyan)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  Wygenerowana odpowiedź próbna
                </h4>
                <div style={{
                  padding: "12px",
                  backgroundColor: "rgba(0, 0, 0, 0.25)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  color: "#d4d4d8",
                  whiteSpace: "pre-wrap",
                  maxHeight: "150px",
                  overflowY: "auto"
                }}>
                  {runA.results.ollama.response}
                </div>
              </div>
            )}
          </div>
        )}

        {/* KOLUMNA B */}
        {runB && (
          <div className="glass-panel" style={{ padding: "24px", borderTop: "4px solid var(--accent-purple)" }}>
            {/* Nagłówek modelu B */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--accent-purple)", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Model B
                </span>
                <h3 style={{ fontSize: "20px", fontWeight: "800", marginTop: "2px" }}>
                  {runB.results?.ollama?.model || runB.selected_model}
                </h3>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>
                  Data testu: {new Date(runB.timestamp).toLocaleString()}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>
                  Trudność: <strong style={{ color: "var(--accent-amber)" }}>
                    {runB.complexity === "quick" ? "Szybki" : runB.complexity === "complex" ? "Zaawansowany" : "Średni"}
                  </strong>
                </span>
              </div>

              {/* Plakietka porównawcza */}
              {winner === "B" && percentDiff > 0 && (
                <span style={{ backgroundColor: "rgba(0, 230, 118, 0.15)", color: "var(--accent-green)", fontSize: "12px", fontWeight: "700", padding: "6px 12px", borderRadius: "20px", border: "1px solid rgba(0, 230, 118, 0.3)" }}>
                  🏆 Szybszy o {percentDiff}%
                </span>
              )}
              {winner === "B" && percentDiff === 0 && (
                <span style={{ backgroundColor: "rgba(255, 235, 59, 0.1)", color: "var(--accent-amber)", fontSize: "12px", fontWeight: "700", padding: "6px 12px", borderRadius: "20px", border: "1px solid rgba(255, 235, 59, 0.2)" }}>
                  ⚖️ Remis
                </span>
              )}
              {winner === "A" && percentDiff > 0 && (
                <span style={{ backgroundColor: "rgba(255, 23, 68, 0.1)", color: "var(--accent-red)", fontSize: "12px", fontWeight: "700", padding: "6px 12px", borderRadius: "20px", border: "1px solid rgba(255, 23, 68, 0.2)" }}>
                  🐢 Wolniejszy
                </span>
              )}
            </div>

            {/* Skrócona specyfikacja platformy testowej */}
            <div style={{ background: "rgba(0,0,0,0.15)", padding: "10px 14px", borderRadius: "6px", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "20px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <span>CPU: <strong>{runB.specs?.cpu_model?.split(" @")[0] || "CPU"}</strong></span>
              <span>GPU: <strong>{getBestGpu(runB.specs).name}</strong></span>
              <span>VRAM: <strong>{getBestGpu(runB.specs).vram_gb} GB</strong></span>
            </div>

            {/* Metryki liczbowe */}
            <h4 style={{ fontSize: "14px", fontWeight: "800", color: "var(--accent-purple)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
              Wyniki pomiarów wydajności
            </h4>
            <div style={{ overflowX: "auto", marginBottom: "30px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--text-secondary)" }}>Parametr</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--accent-purple)" }}>Wartość</th>
                  </tr>
                </thead>
                <tbody>
                  {runB.results?.ollama && (
                    <>
                      <MetricRowShort label="Szybkość generowania" unit="token/s" value={runB.results.ollama.tokens_per_sec} highlight colorVar="var(--accent-purple)" />
                      <MetricRowShort label="Czas całkowity" unit="s" value={runB.results.ollama.total_time_sec} />
                      <MetricRowShort label="Czas ładowania modelu" unit="s" value={runB.results.ollama.load_duration_sec} />
                      <MetricRowShort label="Opóźnienie (TTFT)" unit="s" value={runB.results.ollama.latency_sec} />
                      <MetricRowShort label="Wygenerowane tokeny" unit="token" value={runB.results.ollama.tokens_generated} />
                      <MetricRowShort label="Szybkość czytania pytania" unit="token/s" value={runB.results.ollama.prompt_eval_tokens_per_sec} />

                      {runB.results.ollama.gpu_metrics_available ? (
                        <>
                          <MetricRowShort label="Średnie zużycie VRAM" unit="MB" value={runB.results.ollama.gpu_vram_used_mb} />
                          <MetricRowShort label="Obciążenie GPU" unit="%" value={runB.results.ollama.gpu_util_percent} />
                          <MetricRowShort label="Temperatura GPU" unit="°C" value={runB.results.ollama.gpu_temp_c} />
                        </>
                      ) : (
                        <tr>
                          <td colSpan="2" style={{ padding: "6px 8px", color: "var(--text-muted)", fontStyle: "italic" }}>
                            GPU (nvidia-smi) — niedostępne
                          </td>
                        </tr>
                      )}

                      <MetricRowShort label="Średnie obciążenie CPU" unit="%" value={runB.results.ollama.sys_cpu_percent} />
                      <MetricRowShort label="Średnie zużycie RAM" unit="%" value={runB.results.ollama.sys_ram_percent} />
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Kompatybilność i offload */}
            <h4 style={{ fontSize: "14px", fontWeight: "800", color: "var(--accent-purple)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "16px" }}>
              Analiza alokacji pamięci i warstw
            </h4>
            <div style={{ marginBottom: "30px" }}>
              <CompatibilityPanel
                specs={runB.specs}
                fixedModelName={runB.results?.ollama?.model || runB.selected_model}
                fixedModelDetails={{
                  parameter_size: runB.results?.ollama?.parameter_size,
                  quantization_level: runB.results?.ollama?.quantization_level,
                  family: runB.results?.ollama?.family,
                  model_size_bytes: runB.results?.ollama?.model_size_bytes,
                  model_size_vram_bytes: runB.results?.ollama?.model_size_vram_bytes
                }}
                hideSelectors={true}
                actualTps={runB.results?.ollama?.tokens_per_sec}
              />
            </div>

            {/* Wygenerowana odpowiedź testowa */}
            {runB.results?.ollama?.response && (
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: "800", color: "var(--accent-purple)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  Wygenerowana odpowiedź próbna
                </h4>
                <div style={{
                  padding: "12px",
                  backgroundColor: "rgba(0, 0, 0, 0.25)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  color: "#d4d4d8",
                  whiteSpace: "pre-wrap",
                  maxHeight: "150px",
                  overflowY: "auto"
                }}>
                  {runB.results.ollama.response}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// Pomocniczy wiersz tabeli o krótkiej strukturze
function MetricRowShort({ label, unit, value, highlight, colorVar = "var(--accent-cyan)" }) {
  return (
    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.03)" }}>
      <td style={{ padding: "8px", color: "var(--text-secondary)" }}>
        {label}
      </td>
      <td style={{
        padding: "8px",
        textAlign: "right",
        fontWeight: highlight ? "700" : "500",
        color: highlight ? colorVar : "var(--text-primary)"
      }}>
        {value !== undefined && value !== null ? `${value} ${unit}` : "—"}
      </td>
    </tr>
  );
}
