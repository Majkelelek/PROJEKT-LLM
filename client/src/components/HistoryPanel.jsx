import { useState, useEffect } from "react";

// Komponent HistoryPanel służący do wyświetlania, usuwania oraz eksportowania archiwalnych przebiegów testów.
export default function HistoryPanel({ onSelectRun, activeRunId }) {
  const [runs, setRuns] = useState([]); // Lista historycznych przebiegów benchmarków
  const [loading, setLoading] = useState(true); // Status ładowania historii

  // Pobieranie listy raportów z pamięci przeglądarki (localStorage)
  const fetchRuns = () => {
    try {
      const localData = localStorage.getItem("projekt_ai_history");
      const data = localData ? JSON.parse(localData) : [];
      // Zabezpieczenie dla starych wpisów
      const sanitized = data.map((run, idx) => ({
        ...run,
        id: run.id || run.Id || `run-legacy-${idx}-${new Date(run.timestamp || Date.now()).getTime()}`,
        complexity: run.complexity || "medium"
      }));
      // Sortowanie chronologiczne od najnowszego do najstarszego
      setRuns(sanitized.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch (err) {
      console.error("Błąd podczas pobierania raportów z localStorage:", err);
    } finally {
      setLoading(false);
    }
  };

  // Ładowanie historii na starcie panelu
  useEffect(() => {
    setTimeout(() => {
      fetchRuns();
    }, 0);
  }, []);

  // Usunięcie wybranego wpisu na podstawie ID z localStorage
  const handleDelete = (id, e) => {
    e.stopPropagation(); // Powstrzymujemy wybranie danej pozycji jako aktywnej w tle
    if (!window.confirm("Czy na pewno chcesz usunąć ten rekord testu wydajności?")) return;

    try {
      const localData = localStorage.getItem("projekt_ai_history");
      const data = localData ? JSON.parse(localData) : [];
      const filtered = data.filter(r => r.id !== id);
      localStorage.setItem("projekt_ai_history", JSON.stringify(filtered));
      setRuns(filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch (err) {
      console.error("Błąd podczas usuwania rekordu z localStorage:", err);
    }
  };

  // Eksport surowych danych całego rekordu w formacie JSON do pobrania
  const handleExportJson = (run, e) => {
    e.stopPropagation();
    const dateStr = new Date(run.timestamp).toLocaleDateString().replace(/\//g, "-");
    const filename = `Projekt_AI_Dane_${dateStr}.json`;
    const element = document.createElement("a");
    const file = new Blob([JSON.stringify(run, null, 2)], { type: "application/json" });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Eksport wygenerowanego raportu w formacie tekstowym Markdown (.md)
  const handleDownloadMarkdown = (run, e) => {
    e.stopPropagation();
    if (!run) return;
    const dateStr = new Date(run.timestamp).toLocaleDateString().replace(/\//g, "-");
    const filename = `Projekt_AI_Wyniki_${dateStr}.md`;

    const o = run.results?.ollama;
    const specs = run.specs;
    const gpusJoined = specs?.gpu_details ? specs.gpu_details.map(g => `${g.name} (${g.vram_gb} GB VRAM)`).join(", ") : (specs?.gpus ? specs.gpus.join(", ") : "Brak");

    const md = `# Wyniki pomiarów wydajności AI - ${new Date(run.timestamp).toLocaleString()}

## Specyfikacja Systemu
- **System operacyjny**: ${specs?.os || "N/A"}
- **Procesor (CPU)**: ${specs?.cpu_model || "N/A"} (${specs?.cpu_cores_physical || 0} rdzeni fizycznych, ${specs?.cpu_cores_logical || 0} wątków)
- **Pamięć RAM**: ${specs?.ram_total_gb || 0} GB
- **Karta graficzna**: ${gpusJoined}

## Parametry Modelu i Testu
- **Testowany model**: ${o?.model || run.selected_model || "N/A"}
- **Złożoność testu**: ${run.complexity === "quick" ? "Szybki" : run.complexity === "complex" ? "Zaawansowany" : "Średni"}
- **Rozmiar parametrów**: ${o?.parameter_size || "N/A"}
- **Stopień kwantyzacji**: ${o?.quantization_level || "N/A"}
- **Rodzina modelu**: ${o?.family || "N/A"}

## Wyniki Wydajności (Czasy wnioskowania)
- **Szybkość generowania (eval rate)**: ${o?.tokens_per_sec || 0} tokenów/sekundę
- **Szybkość czytania promptu (prompt eval rate)**: ${o?.prompt_eval_tokens_per_sec || 0} tokenów/sekundę
- **Czas przetwarzania promptu (prompt eval duration)**: ${o?.prompt_eval_duration_sec || 0} s
- **Liczba tokenów promptu (prompt eval count)**: ${o?.prompt_eval_count || 0} tokenów
- **Opóźnienie do pierwszego tokenu (TTFT / latency)**: ${o?.latency_sec || 0} s
- **Czas ładowania modelu (load duration)**: ${o?.load_duration_sec || 0} s
- **Wygenerowane tokeny (eval count)**: ${o?.tokens_generated || 0} tokenów
- **Czas generowania (eval duration)**: ${o?.eval_duration_sec || 0} s
- **Czas całkowity (total duration)**: ${o?.total_time_sec || 0} s

## Telemetria Zasobów (Wartości szczytowe)
${o?.gpu_metrics_available ? `- **Zużycie VRAM**: ${o.gpu_vram_used_mb} / ${o.gpu_vram_total_mb} MB
- **Obciążenie GPU**: ${o.gpu_util_percent}%
- **Średni pobór mocy**: ${o.gpu_power_draw_w} W / ${o.gpu_power_limit_w} W
- **Temperatura GPU**: ${o.gpu_temp_c} °C` : "- **Metryki GPU**: Niedostępne (brak dedykowanej karty graficznej NVIDIA lub sterowników)"}
- **Użycie pamięci RAM**: ${o?.sys_ram_used_gb} / ${o?.sys_ram_total_gb} GB (${o?.sys_ram_percent}%)
- **Średnie obciążenie CPU**: ${o?.sys_cpu_percent}%

## Wygenerowana odpowiedź testowa
\`\`\`
${o?.response || ""}
\`\`\`
`;

    const element = document.createElement("a");
    const file = new Blob([md], { type: "text/markdown" });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
        <div className="spinner spinner-large glowing-text-cyan"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "4px" }}>Historia testów wydajności</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Przeglądaj, analizuj i eksportuj zapisane lokalnie logi z poprzednich testów wydajności.</p>
      </div>

      {runs.length === 0 ? (
        <div className="glass-panel empty-state">
          <div className="empty-icon">📁</div>
          <h3>Nie znaleziono zapisów</h3>
          <p style={{ marginTop: "8px" }}>Uruchom testy wydajności, aby zapisać wyniki do historii lokalnej.</p>
        </div>
      ) : (
        <div className="history-list">
          {runs.map((run) => {
            const date = new Date(run.timestamp);
            const formattedDate = date.toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            }) + " " + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            
            const isLoaded = activeRunId === run.id;

            return (
              <div 
                key={run.id} 
                className="glass-panel history-item"
                style={{ 
                  cursor: "pointer", 
                  borderColor: isLoaded ? "var(--accent-cyan)" : "var(--border-color)",
                  background: isLoaded ? "rgba(0, 229, 255, 0.03)" : "var(--bg-card)",
                  boxShadow: isLoaded ? "var(--shadow-cyan)" : "0 8px 32px 0 rgba(0, 0, 0, 0.4)"
                }}
                onClick={() => onSelectRun(run)}
              >
                {/* Data wykonania testu */}
                <div className="history-date">
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase" }}>Czas wykonania testu</div>
                  <div style={{ fontWeight: "700", marginTop: "4px", color: isLoaded ? "var(--accent-cyan)" : "var(--text-primary)" }}>{formattedDate}</div>
                </div>

                {/* Zapisana specyfikacja procesora, RAMu oraz model testowy */}
                <div className="history-specs">
                  <div className="history-cpu">{run.specs?.cpu_model}</div>
                  <div className="history-sub" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span>{run.specs?.ram_total_gb} GB RAM | Model: {run.selected_model}</span>
                    {run.complexity && (
                      <span className="complexity-tag" style={{
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "10px",
                        fontWeight: "600",
                        textTransform: "uppercase",
                        backgroundColor: run.complexity === "complex" 
                          ? "rgba(167, 139, 250, 0.15)" 
                          : run.complexity === "quick" 
                            ? "rgba(56, 189, 248, 0.15)" 
                            : "rgba(251, 191, 36, 0.15)",
                        color: run.complexity === "complex" 
                          ? "var(--accent-purple)" 
                          : run.complexity === "quick" 
                            ? "var(--accent-cyan)" 
                            : "var(--accent-amber)",
                        border: "1px solid " + (run.complexity === "complex" 
                          ? "rgba(167, 139, 250, 0.3)" 
                          : run.complexity === "quick" 
                            ? "rgba(56, 189, 248, 0.3)" 
                            : "rgba(251, 191, 36, 0.3)")
                      }}>
                        {run.complexity === "quick" ? "Szybki" : run.complexity === "complex" ? "Zaawansowany" : "Średni"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Podgląd skróconych wyników liczbowych (tokens/sec) */}
                <div className="history-scores">
                  {run.results?.ollama && !run.results.ollama.error && run.results.ollama.tokens_per_sec > 0 && (
                    <div className="score-badge" style={{ color: "var(--accent-purple)", borderColor: "rgba(213, 0, 249, 0.15)" }}>
                      LLM: {run.results.ollama.tokens_per_sec} t/s
                    </div>
                  )}
                </div>

                {/* Przyciski operacyjne */}
                <div className="history-actions">
                  <button 
                    className="icon-btn" 
                    title="Eksportuj wyniki (Markdown)"
                    onClick={(e) => handleDownloadMarkdown(run, e)}
                  >
                    📝
                  </button>
                  <button 
                    className="icon-btn" 
                    title="Eksportuj surowe dane JSON"
                    onClick={(e) => handleExportJson(run, e)}
                  >
                    📦
                  </button>
                  <button 
                    className="icon-btn delete" 
                    title="Usuń wpis"
                    onClick={(e) => handleDelete(run.id, e)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
