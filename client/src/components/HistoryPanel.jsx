import React, { useState, useEffect } from "react";

export default function HistoryPanel({ onSelectRun, activeRunId }) {
  // Przechowuje listę historycznych testów
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Funkcja pobierająca listę raportów z backendu
  const fetchRuns = () => {
    try {
      const localData = localStorage.getItem("neurobench_history");
      const data = localData ? JSON.parse(localData) : [];
      // Sortowanie chronologiczne od najnowszego do najstarszego
      setRuns(data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch (err) {
      console.error("Failed to load reports from localStorage:", err);
    } finally {
      setLoading(false);
    }
  };

  // Ładowanie historii na starcie panelu
  useEffect(() => {
    fetchRuns();
  }, []);

  // Usunięcie wybranego wpisu z bazy i odświeżenie widoku
  const handleDelete = (id, e) => {
    e.stopPropagation(); // Powstrzymujemy przeładowanie i wybranie usuwanej pozycji
    if (!window.confirm("Czy na pewno chcesz usunąć ten rekord testu wydajności?")) return;

    try {
      const localData = localStorage.getItem("neurobench_history");
      const data = localData ? JSON.parse(localData) : [];
      const filtered = data.filter(r => r.id !== id);
      localStorage.setItem("neurobench_history", JSON.stringify(filtered));
      setRuns(filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch (err) {
      console.error("Failed to delete record from localStorage:", err);
    }
  };

  // Eksportowanie surowego obiektu JSON jako plik do pobrania
  const handleExportJson = (run, e) => {
    e.stopPropagation();
    const dateStr = new Date(run.timestamp).toLocaleDateString().replace(/\//g, "-");
    const filename = `NeuroBench_Data_${dateStr}.json`;
    const element = document.createElement("a");
    const file = new Blob([JSON.stringify(run, null, 2)], { type: "application/json" });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Eksportowanie raportu tekstowego Markdown stworzonego przez AI
  const handleDownloadMarkdown = (run, e) => {
    e.stopPropagation();
    const dateStr = new Date(run.timestamp).toLocaleDateString().replace(/\//g, "-");
    const filename = `NeuroBench_Report_${dateStr}.md`;
    const element = document.createElement("a");
    const file = new Blob([run.ai_report], { type: "text/markdown" });
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
                {/* Data wykonania */}
                <div className="history-date">
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase" }}>Czas wykonania testu</div>
                  <div style={{ fontWeight: "700", marginTop: "4px", color: isLoaded ? "var(--accent-cyan)" : "var(--text-primary)" }}>{formattedDate}</div>
                </div>

                {/* Główne podzespoły */}
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

                {/* Podgląd wyników liczbowych */}
                <div className="history-scores">
                  {/* Wsparcie dla historycznych wyników CPU/RAM/Ollama */}
                  {run.results?.cpu && !run.results.cpu.error && (
                    <div className="score-badge cyan">
                      CPU: {run.results.cpu.multi_score}
                    </div>
                  )}
                  {run.results?.memory && !run.results.memory.error && (
                    <div className="score-badge">
                      RAM: {Math.round(run.results.memory.read_speed_mbs)} MB/s
                    </div>
                  )}
                  {run.results?.ollama && !run.results.ollama.error && run.results.ollama.tokens_per_sec > 0 && (
                    <div className="score-badge" style={{ color: "var(--accent-purple)", borderColor: "rgba(213, 0, 249, 0.15)" }}>
                      LLM: {run.results.ollama.tokens_per_sec} t/s
                    </div>
                  )}
                </div>

                {/* Przyciski akcji (Eksporty, usuwanie) */}
                <div className="history-actions">
                  <button 
                    className="icon-btn" 
                    title="Eksportuj raport Markdown"
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
