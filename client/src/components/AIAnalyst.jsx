import CompatibilityPanel from "./CompatibilityPanel";

// Komponent AIAnalyst wyświetlający szczegółowe wyniki pomiarów wydajności, alokacji warstw i parametrów testu
export default function AIAnalyst({ currentRun }) {
  // Funkcja eksportująca treść raportu ze wszystkimi metrykami pomiarów do pliku tekstowego Markdown (.md)
  const downloadReport = () => {
    if (!currentRun) return;
    const dateStr = new Date(currentRun.timestamp).toLocaleDateString().replace(/\//g, "-");
    const filename = `Projekt_AI_Wyniki_${dateStr}.md`;
    
    const o = currentRun.results?.ollama;
    const specs = currentRun.specs;
    const gpusJoined = specs?.gpu_details ? specs.gpu_details.map(g => `${g.name} (${g.vram_gb} GB VRAM)`).join(", ") : (specs?.gpus ? specs.gpus.join(", ") : "Brak");

    const md = `# Wyniki pomiarów wydajności AI - ${new Date(currentRun.timestamp).toLocaleString()}

## Specyfikacja Systemu
- **System operacyjny**: ${specs?.os || "N/A"}
- **Procesor (CPU)**: ${specs?.cpu_model || "N/A"} (${specs?.cpu_cores_physical || 0} rdzeni fizycznych, ${specs?.cpu_cores_logical || 0} wątków)
- **Pamięć RAM**: ${specs?.ram_total_gb || 0} GB
- **Karta graficzna**: ${gpusJoined}

## Parametry Modelu i Testu
- **Testowany model**: ${o?.model || currentRun.selected_model || "N/A"}
- **Złożoność testu**: ${currentRun.complexity === "quick" ? "Szybki" : currentRun.complexity === "complex" ? "Zaawansowany" : "Średni"}
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

    // Utworzenie tymczasowego elementu hiperłącza z adresem blob i wywołanie kliknięcia pobierania
    const element = document.createElement("a");
    const file = new Blob([md], { type: "text/markdown" });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Ekran pusty w przypadku braku przeprowadzonego benchmarku
  if (!currentRun) {
    return (
      <div className="glass-panel empty-state animate-fade-in">
        <div className="empty-icon">📊</div>
        <h2>Brak aktywnych danych z testów</h2>
        <p style={{ marginTop: "8px", color: "var(--text-secondary)" }}>
          Przejdź do zakładki <strong>Uruchom testy</strong> i wykonaj testy, aby wyświetlić szczegółowe wyniki.
        </p>
      </div>
    );
  }

  return (
    <div className="ai-layout animate-fade-in">
      <div className="report-panel glass-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent-cyan)", fontWeight: "bold" }}>
              Wyniki pomiarów
            </span>
            <h2 style={{ fontSize: "22px", fontWeight: "800", marginTop: "4px" }}>Szczegółowe wyniki testu</h2>
          </div>
          <button className="btn btn-secondary" onClick={downloadReport}>
            📥 Eksportuj wyniki (Markdown)
          </button>
        </div>

        {currentRun.results?.ollama && !currentRun.results.ollama.error && currentRun.results.ollama.tokens_per_sec > 0 && (
          <div style={{ marginTop: "12px" }}>
            {/* Tabela metryk */}
            <div style={{ overflowX: "auto", marginBottom: "30px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", fontFamily: "var(--font-mono)" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-color)" }}>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: "600", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Parametr</th>
                    <th style={{ textAlign: "center", padding: "8px 12px", color: "var(--text-secondary)", fontWeight: "600", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Jednostka</th>
                    <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--accent-cyan)", fontWeight: "700", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Wartość</th>
                  </tr>
                </thead>
                <tbody>
                  {/* ── SEKCJA 1: Ollama verbose ── */}
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
                    value={currentRun.results.ollama.total_time_sec} 
                  />
                  <MetricRow 
                    label="load duration (Czas ładowania modelu)" 
                    description="Czas potrzebny na wczytanie wag modelu LLM do pamięci RAM/VRAM."
                    interpretation="less_better"
                    unit="s" 
                    value={currentRun.results.ollama.load_duration_sec} 
                  />
                  <MetricRow 
                    label="prompt eval count (Tokeny promptu)" 
                    description="Liczba tokenów (słów/części słów) w pytaniu wejściowym."
                    interpretation="neutral"
                    unit="token" 
                    value={currentRun.results.ollama.prompt_eval_count} 
                  />
                  <MetricRow 
                    label="prompt eval duration (Czas czytania promptu)" 
                    description="Czas spędzony przez model na przetworzenie i zrozumienie pytania."
                    interpretation="less_better"
                    unit="s" 
                    value={currentRun.results.ollama.prompt_eval_duration_sec} 
                  />
                  <MetricRow 
                    label="latency / TTFT (Opóźnienie do pierwszego tokenu)" 
                    description="Czas upływający do wygenerowania pierwszego tokenu (suma czasu ładowania i przetwarzania promptu)."
                    interpretation="less_better"
                    unit="s" 
                    value={currentRun.results.ollama.latency_sec} 
                  />
                  <MetricRow 
                    label="prompt eval rate (Szybkość czytania pytania)" 
                    description="Prędkość przetwarzania tekstu wejściowego (promptu) przez model."
                    interpretation="more_better"
                    unit="token/s" 
                    value={currentRun.results.ollama.prompt_eval_tokens_per_sec} 
                    highlight 
                  />
                  <MetricRow 
                    label="eval count (Wygenerowane tokeny)" 
                    description="Liczba tokenów wygenerowanych przez model w odpowiedzi."
                    interpretation="neutral"
                    unit="token" 
                    value={currentRun.results.ollama.tokens_generated} 
                  />
                  <MetricRow 
                    label="eval duration (Czas generowania)" 
                    description="Czas spędzony przez model na faktycznym generowaniu odpowiedzi token po tokenie."
                    interpretation="less_better"
                    unit="s" 
                    value={currentRun.results.ollama.eval_duration_sec} 
                  />
                  <MetricRow 
                    label="eval rate (Szybkość generowania)" 
                    description="Główny wyznacznik wydajności. Prędkość tworzenia nowych tokenów odpowiedzi."
                    interpretation="more_better"
                    unit="token/s" 
                    value={currentRun.results.ollama.tokens_per_sec} 
                    highlight 
                  />

                  {/* ── SEKCJA 2: GPU — nvidia-smi ── */}
                  {currentRun.results.ollama.gpu_metrics_available && (
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
                        value={`${currentRun.results.ollama.gpu_vram_used_mb} / ${currentRun.results.ollama.gpu_vram_total_mb}`}
                      />
                      <MetricRow 
                        label="Obciążenie GPU" 
                        description="Wykorzystanie rdzeni procesora karty graficznej podczas testu (powinno być wysokie przy akceleracji)."
                        interpretation="more_better"
                        unit="%" 
                        value={currentRun.results.ollama.gpu_util_percent} 
                      />
                      <MetricRow 
                        label="Pobór mocy / limit mocy" 
                        description="Chwilowy pobór prądu przez kartę w stosunku do limitu TDP."
                        interpretation="neutral"
                        unit="W" 
                        value={`${currentRun.results.ollama.gpu_power_draw_w} / ${currentRun.results.ollama.gpu_power_limit_w}`} 
                      />
                      <MetricRow 
                        label="Temperatura GPU" 
                        description="Temperatura rdzenia karty graficznej pod obciążeniem."
                        interpretation="less_better"
                        unit="°C" 
                        value={currentRun.results.ollama.gpu_temp_c} 
                      />
                    </>
                  )}
                  {!currentRun.results.ollama.gpu_metrics_available && (
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
                    value={`${currentRun.results.ollama.sys_ram_used_gb} / ${currentRun.results.ollama.sys_ram_total_gb} (${currentRun.results.ollama.sys_ram_percent}%)`}
                  />
                  <MetricRow 
                    label="Obciążenie procesora (CPU)" 
                    description="Średnie wykorzystanie rdzeni głównego procesora komputera."
                    interpretation="less_better"
                    unit="%" 
                    value={currentRun.results.ollama.sys_cpu_percent} 
                  />
                </tbody>
              </table>
            </div>

            <h3 style={{ fontSize: "16px", fontWeight: "800", marginBottom: "16px", color: "var(--accent-cyan)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Wizualna analiza alokacji pamięci i warstw
            </h3>
            <CompatibilityPanel 
              specs={currentRun.specs} 
              fixedModelName={currentRun.results.ollama.model}
              fixedModelDetails={{
                parameter_size: currentRun.results.ollama.parameter_size,
                quantization_level: currentRun.results.ollama.quantization_level,
                family: currentRun.results.ollama.family,
                model_size_bytes: currentRun.results.ollama.model_size_bytes,
                model_size_vram_bytes: currentRun.results.ollama.model_size_vram_bytes
              }}
              hideSelectors={true}
              actualTps={currentRun.results.ollama.tokens_per_sec}
            />

            {/* Wygenerowana odpowiedź testowa */}
            {currentRun.results.ollama.response && (
              <div style={{ marginTop: "30px", borderTop: "1px dashed var(--border-color)", paddingTop: "20px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "800", marginBottom: "12px", color: "var(--accent-cyan)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Wygenerowana odpowiedź testowa
                </h3>
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
                  {currentRun.results.ollama.response}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
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
