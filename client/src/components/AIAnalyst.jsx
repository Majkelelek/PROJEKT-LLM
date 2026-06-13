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

        {/* Jeżeli test Ollama powiódł się, dołączamy pod spodem analizę pamięci i warstw */}
        {currentRun.results?.ollama && !currentRun.results.ollama.error && currentRun.results.ollama.tokens_per_sec > 0 && (
          <div style={{ marginTop: "40px", borderTop: "1px solid var(--border-color)", paddingTop: "30px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "800", marginBottom: "16px", color: "var(--accent-cyan)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Wizualna analiza alokacji pamięci i warstw
            </h3>
            <CompatibilityPanel 
              specs={currentRun.specs} 
              fixedModelName={currentRun.results.ollama.model}
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
