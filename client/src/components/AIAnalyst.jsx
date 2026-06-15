import CompatibilityPanel from "./CompatibilityPanel";

// Komponent AIAnalyst wyświetlający ekspercką ocenę AI wygenerowaną przez LLM Ollama wraz z wbudowanym parserem Markdown i pobieraniem.
export default function AIAnalyst({ currentRun }) {
  // Funkcja eksportująca treść raportu AI do pliku tekstowego Markdown (.md)
  const downloadReport = () => {
    if (!currentRun) return;
    const dateStr = new Date(currentRun.timestamp).toLocaleDateString().replace(/\//g, "-");
    const filename = `Projekt_AI_Raport_${dateStr}.md`;
    
    // Utworzenie tymczasowego elementu hiperłącza z adresem blob i wywołanie kliknięcia pobierania
    const element = document.createElement("a");
    const file = new Blob([currentRun.ai_report], { type: "text/markdown" });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Bezpieczny, lekki parser składni Markdown (nagłówki, listy, paragrafy) oparty o wyrażenia regularne
  const parseMarkdown = (markdown) => {
    if (!markdown) return null;
    
    // Podział tekstu na bloki za pomocą podwójnych znaków nowej linii
    const blocks = markdown.split(/\n\n+/);
    
    return blocks.map((block, idx) => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) return null;

      // Nagłówek H1: # Tytuł
      if (trimmedBlock.startsWith("# ")) {
        return <h1 key={idx}>{parseInlineMarkdown(trimmedBlock.replace(/^#\s+/, ""))}</h1>;
      }
      // Nagłówek H2: ## Tytuł
      if (trimmedBlock.startsWith("## ")) {
        return <h2 key={idx}>{parseInlineMarkdown(trimmedBlock.replace(/^##\s+/, ""))}</h2>;
      }
      // Nagłówek H3: ### Tytuł
      if (trimmedBlock.startsWith("### ")) {
        return <h3 key={idx}>{parseInlineMarkdown(trimmedBlock.replace(/^###\s+/, ""))}</h3>;
      }
      
      // Listy nienumerowane (wypunktowane): - Element lub * Element
      if (trimmedBlock.startsWith("- ") || trimmedBlock.startsWith("* ")) {
        const items = trimmedBlock.split(/\n[-*]\s+/);
        items[0] = items[0].replace(/^[-*]\s+/, ""); // Oczyszczenie znacznika z pierwszego elementu
        return (
          <ul key={idx}>
            {items.map((item, itemIdx) => (
              <li key={itemIdx}>{parseInlineMarkdown(item)}</li>
            ))}
          </ul>
        );
      }

      // Listy numerowane: 1. Element
      if (/^\d+\.\s+/.test(trimmedBlock)) {
        const items = trimmedBlock.split(/\n\d+\.\s+/);
        items[0] = items[0].replace(/^\d+\.\s+/, "");
        return (
          <ol key={idx}>
            {items.map((item, itemIdx) => (
              <li key={itemIdx}>{parseInlineMarkdown(item)}</li>
            ))}
          </ol>
        );
      }

      // Zwykły akapit tekstu
      return <p key={idx}>{parseInlineMarkdown(trimmedBlock)}</p>;
    });
  };

  // Helper do procesowania stylów wewnątrzblokowych (pogrubienie **, kod `)
  const parseInlineMarkdown = (text) => {
    let parts = [text];

    // 1. Przetwarzanie pogrubienia (**tekst**)
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return part;
      const regex = /\*\*(.*?)\*\*/g;
      const subParts = [];
      let lastIndex = 0;
      let match;
      
      while ((match = regex.exec(part)) !== null) {
        if (match.index > lastIndex) {
          subParts.push(part.substring(lastIndex, match.index));
        }
        subParts.push(<strong key={match.index}>{match[1]}</strong>);
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < part.length) {
        subParts.push(part.substring(lastIndex));
      }
      return subParts;
    });

    // 2. Przetwarzanie bloków kodu (`kod`)
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return part;
      const regex = /`(.*?)`/g;
      const subParts = [];
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(part)) !== null) {
        if (match.index > lastIndex) {
          subParts.push(part.substring(lastIndex, match.index));
        }
        subParts.push(<code key={match.index}>{match[1]}</code>);
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < part.length) {
        subParts.push(part.substring(lastIndex));
      }
      return subParts;
    });

    return parts;
  };

  // Ekran pusty w przypadku braku przeprowadzonego benchmarku
  if (!currentRun) {
    return (
      <div className="glass-panel empty-state animate-fade-in">
        <div className="empty-icon">📊</div>
        <h2>Brak aktywnych danych z testów</h2>
        <p style={{ marginTop: "8px", color: "var(--text-secondary)" }}>
          Przejdź do zakładki <strong>Uruchom testy</strong> i wykonaj testy, aby wygenerować raport AI.
        </p>
      </div>
    );
  }

  return (
    <div className="ai-layout animate-fade-in">
      <div className="report-panel glass-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent-purple)", fontWeight: "bold" }}>
              Raport analityka
            </span>
            <h2 style={{ fontSize: "22px", fontWeight: "800", marginTop: "4px" }}>Ekspercka ocena wydajności AI</h2>
          </div>
          <button className="btn btn-secondary" onClick={downloadReport}>
            📥 Eksportuj Markdown
          </button>
        </div>
        
        {/* Renderowanie przeliterowanego dokumentu Markdown */}
        <div className="markdown-body">
          {parseMarkdown(currentRun.ai_report)}
        </div>

        {/* Jeżeli test Ollama powiódł się, dołączamy pod spodem wyniki pomiarów oraz analizę pamięci i warstw */}
        {currentRun.results?.ollama && !currentRun.results.ollama.error && currentRun.results.ollama.tokens_per_sec > 0 && (
          <div style={{ marginTop: "40px", borderTop: "1px solid var(--border-color)", paddingTop: "30px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "800", marginBottom: "16px", color: "var(--accent-cyan)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Szczegółowe wyniki pomiarów wydajności
            </h3>

            {/* Tabela metryk — identyczny układ jak w BenchmarkPanel */}
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
                family: currentRun.results.ollama.family
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
