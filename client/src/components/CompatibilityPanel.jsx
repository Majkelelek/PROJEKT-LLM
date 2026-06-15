import { useState } from "react";

// Predefiniowana lista popularnych modeli do kalkulatora zgodności sprzętowej
const PREDEFINED_MODELS = [
  { id: "llama32-1b", name: "Llama 3.2 (1B)", sizeB: 1.2, layers: 16, description: "Ultralekki model do prostych zadań i urządzeń mobilnych" },
  { id: "llama32-3b", name: "Llama 3.2 (3B)", sizeB: 3.2, layers: 28, description: "Optymalny mały model do czatu i prostego kodowania" },
  { id: "llama31-8b", name: "Llama 3.1 / 3.3 (8B)", sizeB: 8.0, layers: 32, description: "Standardowy, bardzo inteligentny model ogólnego przeznaczenia" },
  { id: "phi4-14b", name: "Phi-4 (14B)", sizeB: 14.0, layers: 40, description: "Zaawansowany model od Microsoftu, świetna logika i matematyka" },
  { id: "qwen25-32b", name: "Qwen 2.5 (32B)", sizeB: 32.5, layers: 64, description: "Bardzo potężny model, wysoka precyzja i wielojęzyczność" },
  { id: "llama3-70b", name: "Llama 3.1 (70B)", sizeB: 70.0, layers: 80, description: "Model klasy korporacyjnej o najwyższym poziomie inteligencji" },
  { id: "deepseek-14b", name: "DeepSeek R1 Distill (14B)", sizeB: 14.0, layers: 40, description: "Model rozumujący (reasoning) o podwyższonej logice matematycznej" },
  { id: "deepseek-70b", name: "DeepSeek R1 Distill (70B)", sizeB: 70.0, layers: 80, description: "Zaawansowany model rozumujący klasy premium" },
  { id: "deepseek-671b", name: "DeepSeek R1 (671B - MoE)", sizeB: 671.0, layers: 60, description: "Pełny, gigantyczny model Mixture of Experts (MoE) - ekstremalnie ciężki" }
];

// Predefiniowane stopnie kwantyzacji (kompresji) modeli
const QUANTIZATIONS = [
  { id: "Q4_K_M", name: "4-bit (Q4_K_M)", multiplier: 0.62, overhead: 0.6, label: "Zalecana lokalna kwantyzacja (niska utrata jakości, wysoka wydajność)" },
  { id: "Q8_0", name: "8-bit (Q8_0)", multiplier: 1.02, overhead: 0.8, label: "Wysoka precyzja (znikoma utrata jakości, średnia wydajność)" },
  { id: "FP16", name: "16-bit (FP16)", multiplier: 2.05, overhead: 1.5, label: "Brak kompresji / Pełna precyzja (bardzo ciężki dla sprzętu)" }
];

function parseOllamaModel(modelName, modelDetails = null) {
  let sizeB = null;
  let layers = null;
  let displayName = "Brak informacji";

  // Używamy wyłącznie surowych danych pobranych z systemu (z obiektu modelDetails)
  if (modelDetails) {
    // 1. Rozmiar parametrów bezpośrednio z systemu
    if (modelDetails.parameter_size) {
      const match = modelDetails.parameter_size.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        sizeB = parseFloat(match[1]);
      }
    }

    // 2. Nazwa wyświetlana na podstawie surowych danych
    if (sizeB !== null) {
      const cleanName = modelName.split(":")[0];
      const capitalized = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      displayName = `${capitalized} (${modelDetails.parameter_size || `${sizeB}B`})`;
    }
  }

  return { sizeB, layers, displayName };
}

// Komponent panelu kompatybilności (CompatibilityPanel) oceniający możliwość uruchomienia wybranego modelu na wykrytym sprzęcie
export default function CompatibilityPanel({ specs, fixedModelName = null, fixedModelDetails = null, hideSelectors = false, actualTps = null }) {
  const [selectedModelId, setSelectedModelId] = useState("llama32-3b");
  const [selectedQuantId, setSelectedQuantId] = useState("Q4_K_M");

  let model;
  let quant = QUANTIZATIONS.find(q => q.id === selectedQuantId) || QUANTIZATIONS[0];

  // Jeśli przekazano konkretny przetestowany model, blokujemy selektory i parsujemy jego parametry
  if (fixedModelName) {
    const parsed = parseOllamaModel(fixedModelName, fixedModelDetails);
    model = {
      id: "fixed-model",
      name: parsed.displayName,
      sizeB: parsed.sizeB,
      layers: parsed.layers,
      description: `Model przetestowany w tym uruchomieniu: ${fixedModelName}`
    };

    // Dopasowujemy kwantyzację wyłącznie do jednej z predefiniowanych, znanych wartości
    if (fixedModelDetails && fixedModelDetails.quantization_level) {
      const qLevel = fixedModelDetails.quantization_level.toUpperCase();
      const matchedQuant = QUANTIZATIONS.find(q => qLevel.includes(q.id.toUpperCase()) || q.id.toUpperCase().includes(qLevel));
      if (matchedQuant) {
        quant = matchedQuant;
      } else {
        // Kwantyzacja nieznana — nie szacujemy, tylko oznaczamy jako brak danych
        quant = null;
      }
    } else {
      quant = null;
    }
  } else {
    model = PREDEFINED_MODELS.find(m => m.id === selectedModelId) || PREDEFINED_MODELS[0];
  }

  // 1. Ustalanie parametrów kart graficznych (VRAM) wyłącznie z danych systemowych
  const gpus = specs?.gpu_details || [];

  // Wybieramy kartę z największą ilością pamięci VRAM jako kartę główną pod obliczenia LLM
  const activeGpu = gpus.reduce((best, curr) => {
    return curr.vram_gb > best.vram_gb ? curr : best;
  }, { name: "Brak danych", vram_gb: 0.0 });

  const totalRam = specs?.ram_total_gb ?? null;
  const cpuCores = specs?.cpu_cores_physical ?? null;

  const hasInfo = model.sizeB !== null && quant !== null;
  // Liczba warstw jest znana tylko jeśli model ma dane systemowe (layers != null)
  const hasLayers = model.layers !== null;

  // 2. Obliczenia podziału warstw modelu i zapotrzebowania na pamięć
  const requiredMemory = hasInfo ? Math.round((model.sizeB * quant.multiplier + quant.overhead) * 10) / 10 : null;

  // Rezerwujemy 0.7 GB pamięci VRAM na obsługę systemu operacyjnego i pulpitu
  const vramAvailable = Math.max(0, activeGpu.vram_gb - 0.7);
  const numLayers = hasLayers ? model.layers : null;
  const memoryPerLayer = (hasInfo && hasLayers && numLayers > 0) ? requiredMemory / numLayers : null;

  // Liczymy ile warstw modelu zmieści się bezpośrednio w szybkiej pamięci VRAM
  let layersInVram = 0;
  if (hasInfo && hasLayers && memoryPerLayer > 0 && vramAvailable > 0) {
    layersInVram = Math.floor(vramAvailable / memoryPerLayer);
    if (layersInVram > numLayers) layersInVram = numLayers;
  }

  // Pozostałe warstwy będą zrzucone do pamięci RAM
  const layersInRam = hasLayers ? numLayers - layersInVram : null;
  const ramRequired = (hasInfo && hasLayers && memoryPerLayer !== null) ? layersInRam * memoryPerLayer : null;

  // Rezerwujemy 4.5 GB pamięci systemowej RAM na system Windows i inne procesy użytkownika
  const ramAvailableForModel = totalRam !== null ? Math.max(0, totalRam - 4.5) : null;
  const fitsInRam = (ramRequired !== null && ramAvailableForModel !== null) ? ramRequired <= ramAvailableForModel : null;

  // Jeśli pozostałe warstwy nie mieszczą się w RAMie, następuje zrzucenie do pliku wymiany (swap na dysku)
  let layersInSwap = 0;
  if (hasInfo && hasLayers && fitsInRam === false && memoryPerLayer !== null) {
    if (ramAvailableForModel > 0) {
      const layersThatFitInRam = Math.floor(ramAvailableForModel / memoryPerLayer);
      layersInSwap = numLayers - layersInVram - layersThatFitInRam;
    } else {
      layersInSwap = numLayers - layersInVram;
    }
    if (layersInSwap < 0) layersInSwap = 0;
  }

  const layersInRamActual = (hasInfo && hasLayers) ? numLayers - layersInVram - layersInSwap : null;

  // Obliczanie procentowego wskaźnika zgodności sprzętowej (Compatibility Score)
  // Wymaga: rozmiaru modelu (hasInfo) + danych RAM z systemu
  let compatibilityScore = null;
  if (hasInfo && totalRam !== null) {
    if (requiredMemory <= activeGpu.vram_gb) {
      compatibilityScore = 100;
    } else if (ramAvailableForModel !== null && requiredMemory <= (activeGpu.vram_gb + ramAvailableForModel)) {
      const vramRatio = activeGpu.vram_gb / requiredMemory;
      compatibilityScore = Math.round(45 + vramRatio * 45); // Zakres 45% - 90%
    } else if (ramAvailableForModel !== null) {
      const totalAvailable = activeGpu.vram_gb + ramAvailableForModel;
      const ratio = totalAvailable / requiredMemory;
      compatibilityScore = Math.round(Math.max(10, ratio * 40)); // Zakres 10% - 40%
    }
  }

  // Prędkość — wyłącznie rzeczywiste zmierzone dane, bez żadnego szacowania
  const displayTps = actualTps !== null ? actualTps : null;

  // Ustalenie statusu dopasowania oraz tekstu werdyktu w języku polskim
  let statusText;
  let statusColor;
  let statusBg;
  let verdictMessage;

  if (!hasInfo) {
    statusText = "Brak informacji";
    statusColor = "var(--text-muted)";
    statusBg = "rgba(255, 255, 255, 0.05)";
    verdictMessage = "Brak szczegółowych danych technicznych o testowanym modelu LLM w systemie (rozmiar parametrów lub liczba warstw sieci jest nieznana). Nie można przeprowadzić symulacji alokacji sprzętowej.";
  } else if (compatibilityScore >= 90) {
    statusText = "Znakomita";
    statusColor = "var(--accent-green)";
    statusBg = "rgba(0, 230, 118, 0.1)";
    verdictMessage = "Model w pełni zmieści się w szybkiej pamięci VRAM karty graficznej. Otrzymasz błyskawiczne generowanie tekstu.";
  } else if (compatibilityScore >= 70) {
    statusText = "Dobra (Płynna)";
    statusColor = "var(--accent-cyan)";
    statusBg = "rgba(0, 229, 255, 0.1)";
    verdictMessage = "Większość warstw modelu zmieści się w VRAM-ie karty graficznej, a reszta w pamięci RAM. Działanie będzie płynne, choć minimalnie wolniejsze.";
  } else if (compatibilityScore >= 45) {
    statusText = "Dostateczna (Wolna)";
    statusColor = "var(--accent-amber)";
    statusBg = "rgba(255, 234, 0, 0.1)";
    verdictMessage = "Model wymaga więcej pamięci niż posiada Twoja karta graficzna. Działanie przejdzie w tryb hybrydowy (RAM + VRAM) lub czysty CPU, co znacznie obniży szybkość generowania.";
  } else {
    statusText = "Niewystarczająca";
    statusColor = "var(--accent-red)";
    statusBg = "rgba(255, 23, 68, 0.1)";
    verdictMessage = "Rozmiar modelu przekracza dostępną pamięć RAM i VRAM. System zacznie zrzucać warstwy na dysk twardy (swap), co spowoduje drastyczny spadek prędkości (< 1 t/s) lub błąd braku pamięci (OOM).";
  }

  // Parametry wskaźnika okrągłego SVG
  const radius = 65;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = hasInfo ? circumference - (compatibilityScore / 100) * circumference : circumference;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* Selektory wyboru modelu i kwantyzacji (ukrywane, gdy wywołujemy w podglądzie wyników) */}
      {!hideSelectors ? (
        <div className="glass-panel" style={{ padding: "24px", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px" }}>
          {/* Lewy panel selektorów */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "700" }}>Wybierz model i kwantyzację</h3>

            <div className="control-group">
              <label className="control-label" htmlFor="compat-model-select">Model językowy (LLM)</label>
              <select
                id="compat-model-select"
                className="select-input"
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
              >
                {PREDEFINED_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.sizeB}B parametrów)
                  </option>
                ))}
              </select>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                {model.description}
              </span>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="compat-quant-select">Stopień kompresji (Kwantyzacja)</label>
              <select
                id="compat-quant-select"
                className="select-input"
                value={selectedQuantId}
                onChange={(e) => setSelectedQuantId(e.target.value)}
              >
                {QUANTIZATIONS.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                {quant.label}
              </span>
            </div>
          </div>

          {/* Prawy panel wykrytego sprzętu systemowego */}
          <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: "10px", padding: "20px", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent-cyan)", fontWeight: "bold", marginBottom: "12px" }}>
                Wykryty sprzęt do obliczeń
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Karta GPU (VRAM):</span>
                  <span style={{ fontWeight: "700", textAlign: "right" }}>
                    {activeGpu.name} <br />
                    <span style={{ color: "var(--accent-cyan)" }}>({activeGpu.vram_gb} GB VRAM)</span>
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "8px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Pamięć RAM:</span>
                  <span style={{ fontWeight: "700" }}>{totalRam} GB</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "8px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Fizyczne rdzenie CPU:</span>
                  <span style={{ fontWeight: "700" }}>{cpuCores} rdzeni</span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "16px", fontStyle: "italic" }}>
              * Dane pobrane automatycznie z telemetrii systemowej Projekt AI.
            </div>
          </div>
        </div>
      ) : (
        /* Horyzontalne minimalistyczne podsumowanie sprzętu w zakładce wyników */
        <div className="glass-panel" style={{ padding: "16px 24px", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--accent-cyan)", fontWeight: "bold", marginBottom: "4px" }}>
              Testowany Model LLM
            </div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "#fff" }}>
              {fixedModelName}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              {model.sizeB !== null ? `Rozmiar: ${model.sizeB}B parametrów` : "Brak danych systemowych o rozmiarze modelu"}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", background: "rgba(0,0,0,0.15)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: "11px" }}>Wykryte GPU:</span>
              <div style={{ fontWeight: "700", fontSize: "12px" }}>{activeGpu.name}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ color: "var(--text-secondary)", fontSize: "11px" }}>Dostępny VRAM:</span>
              <div style={{ fontWeight: "700", color: "var(--accent-cyan)", fontSize: "12px" }}>{activeGpu.vram_gb} GB</div>
            </div>
          </div>
        </div>
      )}

      {/* Wykresy i główne wizualizacje alokacji */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "24px" }}>

        {/* Okrągły wskaźnik wyniku dopasowania i werdyktu */}
        <div className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "700", width: "100%", textAlign: "left" }}>Wynik dopasowania sprzętu</h3>

          <div style={{ position: "relative", width: "160px", height: "160px", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <svg style={{ width: "150px", height: "150px", transform: "rotate(-90deg)" }}>
              <circle
                cx="75"
                cy="75"
                r={radius}
                style={{ fill: "none", stroke: "rgba(255, 255, 255, 0.03)", strokeWidth: "12" }}
              />
              <circle
                cx="75"
                cy="75"
                r={radius}
                stroke={statusColor}
                style={{
                  fill: "none",
                  strokeWidth: "12",
                  strokeLinecap: "round",
                  strokeDasharray: circumference,
                  strokeDashoffset: strokeDashoffset,
                  transition: "stroke-dashoffset 0.6s ease-out, stroke 0.6s ease"
                }}
              />
            </svg>
            <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: "36px", fontWeight: "900", fontFamily: "var(--font-mono)", color: statusColor }}>
                {hasInfo ? `${compatibilityScore}%` : "--%"}
              </span>
              <span style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: "bold" }}>
                Zgodności
              </span>
            </div>
          </div>

          <div style={{ textAlign: "center", width: "100%" }}>
            <div
              style={{
                display: "inline-block",
                padding: "6px 14px",
                borderRadius: "20px",
                fontSize: "14px",
                fontWeight: "700",
                color: statusColor,
                backgroundColor: statusBg,
                marginBottom: "12px",
                border: `1px solid rgba(${statusColor === "var(--accent-green)" ? "0,230,118" : statusColor === "var(--accent-cyan)" ? "0,229,255" : statusColor === "var(--accent-amber)" ? "255,234,0" : "255,23,68"}, 0.2)`
              }}
            >
              Ocena: {statusText}
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5", padding: "0 10px" }}>
              {verdictMessage}
            </p>
          </div>
        </div>

        {/* Wizualizacja podziału warstw (Offloading) w postaci siatki komórek */}
        <div className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "700" }}>Wizualizacja alokacji warstw modelu</h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Sieci LLM przetwarzane są warstwowo. Im więcej warstw trafi do pamięci VRAM GPU, tym wyższa szybkość wnioskowania.
            </p>
          </div>

          {/* Siatka komórek (jedna komórka = jedna warstwa sieci neuronowej) */}
          <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: "8px", border: "1px solid var(--border-color)", padding: "16px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(20px, 1fr))",
                gap: "6px",
                maxHeight: "150px",
                overflowY: "auto",
                paddingRight: "4px"
              }}
            >
              {hasInfo ? (
                Array.from({ length: numLayers }).map((_, idx) => {
                  let cellColor = "rgba(255, 23, 68, 0.25)"; // Swap (Czerwony)
                  let cellBorder = "rgba(255, 23, 68, 0.4)";
                  let titleStr = "Swap / Paging (Dysk)";

                  if (idx < layersInVram) {
                    cellColor = "rgba(0, 229, 255, 0.25)"; // VRAM (Błękitny)
                    cellBorder = "rgba(0, 229, 255, 0.6)";
                    titleStr = "Pamięć VRAM (Karta GPU)";
                  } else if (idx < (layersInVram + layersInRamActual)) {
                    cellColor = "rgba(213, 0, 249, 0.25)"; // RAM (Fioletowy)
                    cellBorder = "rgba(213, 0, 249, 0.6)";
                    titleStr = "Pamięć operacyjna RAM";
                  }

                  return (
                    <div
                      key={idx}
                      className="compat-layer-cell"
                      title={`Warstwa ${idx + 1}/${numLayers}: ${titleStr}`}
                      style={{
                        aspectRatio: "1",
                        borderRadius: "4px",
                        backgroundColor: cellColor,
                        border: `1px solid ${cellBorder}`,
                        color: cellBorder.replace("0.4", "1.0").replace("0.6", "1.0")
                      }}
                    />
                  );
                })
              ) : (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--text-muted)", padding: "20px 0", fontSize: "13px" }}>
                  Brak informacji o strukturze warstw modelu
                </div>
              )}
            </div>

            {/* Legenda siatki offloadingu */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "16px", fontSize: "11px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px" }}>
              {hasInfo ? (
                <>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "rgba(0, 229, 255, 0.25)", border: "1px solid var(--accent-cyan)" }}></span>
                    <span>VRAM GPU ({layersInVram} warstw)</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "rgba(213, 0, 249, 0.25)", border: "1px solid var(--accent-purple)" }}></span>
                    <span>RAM Systemowy ({layersInRamActual !== null ? layersInRamActual : "?"} warstw)</span>
                  </span>
                  {layersInSwap > 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "rgba(255, 23, 68, 0.25)", border: "1px solid var(--accent-red)" }}></span>
                      <span style={{ color: "var(--accent-red)", fontWeight: "bold" }}>Spill / Swap ({layersInSwap} warstw) ⚠️</span>
                    </span>
                  )}
                </>
              ) : (
                <span style={{ color: "var(--text-muted)" }}>Brak danych telemetrycznych o podziale pamięci</span>
              )}
            </div>
          </div>

          {hasInfo ? (
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
              Rozmiar modelu w pamięci: <strong style={{ color: "#fff" }}>{requiredMemory} GB</strong>.
              Wolna pamięć VRAM: <strong style={{ color: "var(--accent-cyan)" }}>{vramAvailable.toFixed(1)} GB</strong>.
              {ramRequired !== null && ramAvailableForModel !== null && (
                <> Wymagany RAM dla reszty warstw: <strong style={{ color: "var(--accent-purple)" }}>{ramRequired.toFixed(1)} GB</strong> (dostępne ok. {ramAvailableForModel.toFixed(1)} GB).</>
              )}
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
              Wolna pamięć VRAM: <strong style={{ color: "var(--accent-cyan)" }}>{vramAvailable.toFixed(1)} GB</strong>.
              Dostępna pamięć RAM: <strong style={{ color: "var(--accent-purple)" }}>{totalRam !== null ? `${totalRam} GB` : "Brak danych"}</strong>.
            </div>
          )}
        </div>
      </div>

      {/* Tabela audytu kompatybilności oraz prognoza prędkości */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px" }}>

        {/* Lista wskaźników dopasowania podzespołów */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "16px" }}>Szczegółowy audyt kompatybilności</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Audyt VRAM */}
            <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span style={{ fontSize: "18px" }}>💾</span>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "700" }}>Pamięć karty graficznej (VRAM)</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Posiadasz {activeGpu.vram_gb} GB VRAM</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                {!hasInfo ? (
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "bold", background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: "4px" }}>Brak informacji</span>
                ) : layersInVram === numLayers ? (
                  <span style={{ fontSize: "12px", color: "var(--accent-green)", fontWeight: "bold", background: "rgba(0,230,118,0.1)", padding: "4px 8px", borderRadius: "4px" }}>✓ Znakomicie</span>
                ) : layersInVram > 0 ? (
                  <span style={{ fontSize: "12px", color: "var(--accent-cyan)", fontWeight: "bold", background: "rgba(0,229,255,0.1)", padding: "4px 8px", borderRadius: "4px" }}>⇅ Offload ({layersInVram}/{numLayers})</span>
                ) : (
                  <span style={{ fontSize: "12px", color: "var(--accent-red)", fontWeight: "bold", background: "rgba(255,23,68,0.1)", padding: "4px 8px", borderRadius: "4px" }}>✗ Brak VRAM (Uruchomienie CPU)</span>
                )}
              </div>
            </div>

            {/* Audyt RAM */}
            <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span style={{ fontSize: "18px" }}>🧠</span>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "700" }}>Pamięć RAM systemu</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Posiadasz {totalRam !== null ? `${totalRam} GB` : "Brak danych"} RAM</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                {!hasInfo || totalRam === null ? (
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "bold", background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: "4px" }}>Brak informacji</span>
                ) : requiredMemory <= totalRam ? (
                  <span style={{ fontSize: "12px", color: "var(--accent-green)", fontWeight: "bold", background: "rgba(0,230,118,0.1)", padding: "4px 8px", borderRadius: "4px" }}>✓ Wystarczająco</span>
                ) : (
                  <span style={{ fontSize: "12px", color: "var(--accent-red)", fontWeight: "bold", background: "rgba(255,23,68,0.1)", padding: "4px 8px", borderRadius: "4px" }}>⚠️ Za mało RAM-u (OOM)</span>
                )}
              </div>
            </div>

            {/* Audyt CPU */}
            <div style={{ display: "flex", justifyItems: "center", justifyContent: "space-between", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span style={{ fontSize: "18px" }}>⚙️</span>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "700" }}>Moc obliczeniowa CPU</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Wykryto {cpuCores !== null ? `${cpuCores} fizycznych rdzeni` : "Brak danych"}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                {cpuCores === null ? (
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "bold", background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: "4px" }}>Brak informacji</span>
                ) : cpuCores >= 8 ? (
                  <span style={{ fontSize: "12px", color: "var(--accent-green)", fontWeight: "bold", background: "rgba(0,230,118,0.1)", padding: "4px 8px", borderRadius: "4px" }}>✓ Wysoka wydajność</span>
                ) : cpuCores >= 6 ? (
                  <span style={{ fontSize: "12px", color: "var(--accent-cyan)", fontWeight: "bold", background: "rgba(0,229,255,0.1)", padding: "4px 8px", borderRadius: "4px" }}>✓ Dobre dopasowanie</span>
                ) : (
                  <span style={{ fontSize: "12px", color: "var(--accent-amber)", fontWeight: "bold", background: "rgba(255,234,0,0.1)", padding: "4px 8px", borderRadius: "4px" }}>⇅ Umiarkowana moc</span>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Prognoza/Pomiar prędkości (t/s) w odniesieniu do średniej prędkości czytania */}
        <div className="glass-panel" style={{ padding: "24px", display: "flex", flexDirection: "column", justifyItems: "stretch", gap: "16px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "700" }}>
            {actualTps !== null ? "Rzeczywista szybkość generowania" : "Szybkość generowania"}
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", flexGrow: 1, justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", justifyContent: "center" }}>
              <span
                style={{
                  fontSize: "48px",
                  fontWeight: "900",
                  fontFamily: "var(--font-mono)",
                  color: displayTps === null ? "var(--text-muted)" : displayTps > 15 ? "var(--accent-green)" : displayTps > 7 ? "var(--accent-cyan)" : displayTps > 3 ? "var(--accent-amber)" : "var(--accent-red)"
                }}
              >
                {displayTps !== null ? displayTps : "--"}
              </span>
              <span style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-secondary)" }}>t/s</span>
            </div>

            <div style={{ textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
              {actualTps !== null ? "Prędkość wnioskowania zmierzona podczas testu." : "Brak zmierzonej prędkości — uruchom test aby uzyskać dane."}
            </div>

            {/* Porównanie z tempem czytania człowieka */}
            <div style={{ borderTop: "1px dashed rgba(255,255,255,0.06)", paddingTop: "12px", marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                <span>Średnie tempo czytania człowieka:</span>
                <span style={{ fontWeight: "700" }}>~8-10 t/s</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                <span>Status generowania:</span>
                <strong
                  style={{
                    color: displayTps === null ? "var(--text-muted)" : displayTps >= 15 ? "var(--accent-green)" : displayTps >= 7 ? "var(--accent-cyan)" : displayTps >= 3 ? "var(--accent-amber)" : "var(--accent-red)"
                  }}
                >
                  {displayTps === null ? "Brak informacji" : displayTps >= 15 ? "Błyskawiczne" : displayTps >= 7 ? "Płynne czytanie" : displayTps >= 3 ? "Powolne" : "Uciążliwie wolne"}
                </strong>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
