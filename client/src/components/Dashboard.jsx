import { useState, useEffect } from "react";

// Komponent głównego panelu kontrolnego (Dashboard) wyświetlający podzespoły sprzętowe oraz wykresy użycia zasobów w czasie rzeczywistym.
export default function Dashboard({ specs, liveMetrics, onRunBenchmarkTab }) {
  const [history, setHistory] = useState([]); // Przechowuje historię punktów wykresu (ostatnie 20 odczytów)
  const [localLive, setLocalLive] = useState(liveMetrics); // Przechowuje aktualne, lokalne dane zużycia zasobów

  // Efekt uruchamiający cykliczne pobieranie (polling) dynamicznych metryk systemu co 1.5 sekundy
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/system-info/live");
        if (res.ok) {
          const data = await res.json();
          setLocalLive(data);
          
          // Aktualizacja historii wykresu (limit do ostatnich 20 odczytów dla optymalizacji wydajności)
          setHistory(prev => {
            const next = [...prev, { time: Date.now(), cpu: data.cpu_percent, ram: data.ram_percent }];
            if (next.length > 20) {
              next.shift(); // Usuwa najstarszy element
            }
            return next;
          });
        }
      } catch (err) {
        console.error("Błąd pobierania metryk na żywo:", err);
      }
    }, 1500);

    return () => clearInterval(interval); // Czyszczenie interwału przy odmontowaniu komponentu
  }, []);

  const cpuPercent = localLive?.cpu_percent ?? 0;
  const ramPercent = localLive?.ram_percent ?? 0;
  const ramUsed = localLive?.ram_used_gb ?? 0;
  const ramTotal = specs?.ram_total_gb ?? 0;

  // Obliczenia parametrów dla okrągłych wskaźników SVG (Gauge)
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffsetCpu = circumference - (cpuPercent / 100) * circumference;
  const strokeDashoffsetRam = circumference - (ramPercent / 100) * circumference;

  // Funkcja obliczająca ciąg punktów (współrzędnych X,Y) dla elementu polyline w wykresie SVG
  const chartWidth = 500;
  const chartHeight = 120;
  const padding = 10;
  const getPointsStr = (key) => {
    if (history.length < 2) return "";
    return history
      .map((d, i) => {
        // Skalowanie współrzędnej X w zależności od indeksu odczytu
        const x = padding + (i / (history.length - 1)) * (chartWidth - padding * 2);
        const val = d[key] ?? 0;
        // Skalowanie współrzędnej Y w zależności od procentu obciążenia (odwrócona oś Y w SVG)
        const y = chartHeight - padding - (val / 100) * (chartHeight - padding * 2);
        return `${x},${y}`;
      })
      .join(" ");
  };

  const cpuPoints = getPointsStr("cpu");
  const ramPoints = getPointsStr("ram");

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
      
      {/* Siatka z kartami specyfikacji technicznej sprzętu */}
      <div className="specs-grid">
        {/* Karta Procesora (CPU) */}
        <div className="spec-card glass-panel" style={{ "--card-accent": "var(--accent-cyan)" }}>
          <div className="spec-icon">💻</div>
          <div className="spec-label">Procesor (CPU)</div>
          <div className="spec-value">{specs?.cpu_model || "Ładowanie szczegółów procesora..."}</div>
          <div className="spec-sub">
            {specs?.cpu_cores_physical} Rdzeni / {specs?.cpu_cores_logical} Wątków 
            {specs?.cpu_max_frequency_mhz ? ` @ ${roundFreq(specs.cpu_max_frequency_mhz)} GHz maks.` : ""}
          </div>
        </div>

        {/* Karta Pamięci RAM */}
        <div className="spec-card glass-panel" style={{ "--card-accent": "var(--accent-purple)" }}>
          <div className="spec-icon">🧠</div>
          <div className="spec-label">Pamięć RAM</div>
          <div className="spec-value">{specs?.ram_total_gb ? `${specs.ram_total_gb} GB` : "Ładowanie pamięci..."}</div>
          <div className="spec-sub">Dostępna pojemność do obliczeń</div>
        </div>

        {/* Karta Karty Graficznej (GPU) */}
        <div className="spec-card glass-panel" style={{ "--card-accent": "var(--accent-green)" }}>
          <div className="spec-icon">🎮</div>
          <div className="spec-label">Karta graficzna (GPU)</div>
          <div className="spec-value">
            {specs?.gpus && specs.gpus.length > 0 ? specs.gpus.join(", ") : "Ładowanie karty graficznej..."}
          </div>
          <div className="spec-sub">Bezpośredni interfejs sprzętowy</div>
        </div>

        {/* Karta Systemu Operacyjnego */}
        <div className="spec-card glass-panel" style={{ "--card-accent": "var(--accent-amber)" }}>
          <div className="spec-icon">⚙️</div>
          <div className="spec-label">System operacyjny</div>
          <div className="spec-value">{specs?.os || "Ładowanie szczegółów systemu..."}</div>
          <div className="spec-sub">Wersja platformy: {specs?.python_version}</div>
        </div>
      </div>

      {/* Sekcja monitorowania obciążenia na żywo */}
      <div className="live-section">
        
        {/* Karta monitorowania obciążenia CPU */}
        <div className="live-card glass-panel">
          <div className="live-card-header">
            <span className="live-card-title">Użycie procesora</span>
            <span className="glowing-text-cyan" style={{ fontFamily: "var(--font-mono)", fontWeight: "bold" }}>
              {cpuPercent.toFixed(1)}%
            </span>
          </div>

          <div className="live-gauge-container">
            <svg className="gauge-svg">
              <defs>
                <linearGradient id="cpuGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--accent-cyan)" />
                  <stop offset="100%" stopColor="var(--accent-purple)" />
                </linearGradient>
              </defs>
              <circle className="gauge-bg" cx="90" cy="90" r={radius} />
              <circle
                className="gauge-fill"
                cx="90"
                cy="90"
                r={radius}
                stroke="url(#cpuGradient)"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffsetCpu}
              />
            </svg>
            <div className="gauge-text-container">
              <span className="gauge-value glowing-text-cyan">{Math.round(cpuPercent)}%</span>
              <span className="gauge-label">Obciążenie CPU</span>
            </div>
          </div>

          {/* Podział obciążenia na poszczególne rdzenie procesora */}
          {localLive?.cpu_percent_per_core && (
            <div>
              <div className="spec-label" style={{ marginBottom: "10px" }}>Obciążenie poszczególnych rdzeni</div>
              <div className="core-grid">
                {localLive.cpu_percent_per_core.map((p, idx) => (
                  <div key={idx} className="core-box">
                    <span className="core-number">C{idx}</span>
                    <span 
                      className="core-val" 
                      style={{ 
                        color: p > 80 ? "var(--accent-red)" : p > 40 ? "var(--accent-amber)" : "var(--accent-green)" 
                      }}
                    >
                      {Math.round(p)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Karta monitorowania alokacji pamięci RAM */}
        <div className="live-card glass-panel">
          <div className="live-card-header">
            <span className="live-card-title">Alokacja pamięci</span>
            <span className="glowing-text-purple" style={{ fontFamily: "var(--font-mono)", fontWeight: "bold" }}>
              {ramUsed.toFixed(1)} / {ramTotal.toFixed(1)} GB
            </span>
          </div>

          <div className="live-gauge-container">
            <svg className="gauge-svg">
              <defs>
                <linearGradient id="ramGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--accent-purple)" />
                  <stop offset="100%" stopColor="var(--accent-red)" />
                </linearGradient>
              </defs>
              <circle className="gauge-bg" cx="90" cy="90" r={radius} />
              <circle
                className="gauge-fill"
                cx="90"
                cy="90"
                r={radius}
                stroke="url(#ramGradient)"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffsetRam}
              />
            </svg>
            <div className="gauge-text-container">
              <span className="gauge-value glowing-text-purple">{Math.round(ramPercent)}%</span>
              <span className="gauge-label">Zajętość RAM</span>
            </div>
          </div>

          {/* Wykres historyczny aktywności rysowany na żywo (SVG line) */}
          <div style={{ marginTop: "10px" }}>
            <div className="spec-label" style={{ marginBottom: "10px" }}>Historia aktywności (Na żywo)</div>
            <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "8px", border: "1px solid var(--border-color)", padding: "10px", display: "flex", justifyContent: "center" }}>
              <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                {/* Przerywane linie pomocnicze siatki */}
                <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="4,4" />
                <line x1="0" y1={chartHeight - padding} x2={chartWidth} y2={chartHeight - padding} stroke="rgba(255,255,255,0.1)" />
                
                {/* Linia zużycia procesora (Cyan) */}
                {cpuPoints && (
                  <polyline
                    fill="none"
                    stroke="var(--accent-cyan)"
                    strokeWidth="2.5"
                    points={cpuPoints}
                    style={{ filter: "drop-shadow(0px 0px 4px rgba(0, 229, 255, 0.4))" }}
                  />
                )}
                {/* Linia zużycia pamięci RAM (Purple) */}
                {ramPoints && (
                  <polyline
                    fill="none"
                    stroke="var(--accent-purple)"
                    strokeWidth="2.5"
                    points={ramPoints}
                    style={{ filter: "drop-shadow(0px 0px 4px rgba(213, 0, 249, 0.4))" }}
                  />
                )}
              </svg>
            </div>
            {/* Legenda wykresu */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "16px", marginTop: "8px", fontSize: "12px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--accent-cyan)" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-cyan)" }}></span> Obciążenie CPU
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--accent-purple)" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-purple)" }}></span> Użycie RAM
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Szybka akcja przekierowania do panelu testów */}
      <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px" }}>Gotowy na ocenę swojego systemu?</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Przetestuj szybkość wnioskowania lokalnych modeli językowych (LLM) na Twoim sprzęcie.</p>
        </div>
        <button className="btn btn-primary" onClick={onRunBenchmarkTab}>
          🚀 Otwórz panel testów
        </button>
      </div>

    </div>
  );
}

// Funkcja pomocnicza zaokrąglająca taktowanie procesora z MHz do GHz
function roundFreq(mhz) {
  return (mhz / 1000).toFixed(2);
}
