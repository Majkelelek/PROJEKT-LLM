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

// Pomocnicza funkcja parsująca nazwę modelu z usługi Ollama na parametry rozmiaru i liczby warstw sieci neuronowej
function parseOllamaModel(modelName) {
  const name = modelName.toLowerCase();
  
  let sizeB = 8.0; 
  let layers = 32;
  let displayName = modelName;
  
  if (name.includes("1.5b") || name.includes("1b")) {
    sizeB = 1.5;
    layers = 16;
    displayName = `Llama / DeepSeek (1.5B)`;
  } else if (name.includes("3b") || name.includes("3.2")) {
    sizeB = 3.2;
    layers = 28;
    displayName = `Llama 3.2 (3B)`;
  } else if (name.includes("8b") || name.includes("3.1") || name.includes("3.3") || name.includes("llama3")) {
    sizeB = 8.0;
    layers = 32;
    displayName = `Llama 3.1 / 3.3 (8B)`;
  } else if (name.includes("14b") || name.includes("phi4") || name.includes("phi-4")) {
    sizeB = 14.0;
    layers = 40;
    displayName = `Phi-4 / DeepSeek (14B)`;
  } else if (name.includes("32b") || name.includes("32")) {
    sizeB = 32.5;
    layers = 64;
    displayName = `Qwen 2.5 (32B)`;
  } else if (name.includes("70b") || name.includes("llama3.3") || name.includes("llama-3.3")) {
    sizeB = 70.0;
    layers = 80;
    displayName = `Llama 3.1 (70B)`;
  } else if (name.includes("671b") || name.includes("r1")) {
    sizeB = 671.0;
    layers = 60;
    displayName = `DeepSeek R1 (671B)`;
  }
  
  return { sizeB, layers, displayName };
}

// Komponent panelu kompatybilności (CompatibilityPanel) oceniający możliwość uruchomienia wybranego modelu na wykrytym sprzęcie
export default function CompatibilityPanel({ specs, fixedModelName = null, hideSelectors = false, actualTps = null }) {
  const [selectedModelId, setSelectedModelId] = useState("llama32-3b");
  const [selectedQuantId, setSelectedQuantId] = useState("Q4_K_M");

  let model;
  let quant = QUANTIZATIONS.find(q => q.id === selectedQuantId) || QUANTIZATIONS[0];

  // Jeśli przekazano konkretny przetestowany model, blokujemy selektory i parsujemy jego parametry
  if (fixedModelName) {
    const parsed = parseOllamaModel(fixedModelName);
    model = {
      id: "fixed-model",
      name: parsed.displayName,
      sizeB: parsed.sizeB,
      layers: parsed.layers,
      description: `Model przetestowany w tym uruchomieniu: ${fixedModelName}`
    };
    quant = QUANTIZATIONS[0];
  } else {
    model = PREDEFINED_MODELS.find(m => m.id === selectedModelId) || PREDEFINED_MODELS[0];
  }

  // 1. Ustalanie parametrów kart graficznych (VRAM)
  let gpus = specs?.gpu_details || [];
  // W przypadku braku dokładnych informacji o pamięci VRAM z WMI, dopasowujemy szacunkowo na podstawie nazwy karty
  if ((!gpus || gpus.length === 0 || (gpus.length === 1 && gpus[0].name === "Unknown GPU")) && specs?.gpus && specs.gpus.length > 0) {
    gpus = specs.gpus.map(gpuName => {
      let vram = 0.5; // Domyślna minimalna wartość
      const upper = gpuName.toUpperCase();
      if (upper.includes("1650")) vram = 4.0;
      else if (upper.includes("1660") || upper.includes("1060")) vram = 6.0;
      else if (upper.includes("3060") || upper.includes("4060")) vram = 12.0;
      else if (upper.includes("4070") || upper.includes("3070")) vram = 8.0;
      else if (upper.includes("4080") || upper.includes("3080")) vram = 16.0;
      else if (upper.includes("4090") || upper.includes("3090")) vram = 24.0;
      else if (upper.includes("1080")) vram = 8.0;
      else if (upper.includes("1070")) vram = 8.0;
      else if (upper.includes("1050")) vram = 2.0;
      else if (upper.includes("RTX")) vram = 8.0;
      else if (upper.includes("GTX")) vram = 4.0;
      return { name: gpuName, vram_gb: vram };
    });
  }
  
  // Wybieramy kartę z największą ilością pamięci VRAM jako kartę główną pod obliczenia LLM
  const activeGpu = gpus.reduce((best, curr) => {
    return curr.vram_gb > best.vram_gb ? curr : best;
  }, { name: "Zintegrowana / Brak dedykowanej", vram_gb: 0.0 });

  const totalRam = specs?.ram_total_gb || 8.0;
  const cpuCores = specs?.cpu_cores_physical || 4;

  // 2. Obliczenia podziału warstw modelu i zapotrzebowania na pamięć
  // Obliczenie szacowanego zapotrzebowania na pamięć RAM/VRAM dla modelu z wybraną kwantyzacją
  const requiredMemory = Math.round((model.sizeB * quant.multiplier + quant.overhead) * 10) / 10;
  
  // Rezerwujemy 0.7 GB pamięci VRAM na obsługę systemu operacyjnego i pulpitu
  const vramAvailable = Math.max(0, activeGpu.vram_gb - 0.7); 
  const numLayers = model.layers;
  const memoryPerLayer = requiredMemory / numLayers;
  
  // Liczymy ile warstw modelu zmieści się bezpośrednio w szybkiej pamięci VRAM
  let layersInVram = 0;
  if (vramAvailable > 0) {
    layersInVram = Math.floor(vramAvailable / memoryPerLayer);
    if (layersInVram > numLayers) layersInVram = numLayers;
  }
  
  // Pozostałe warstwy będą zrzucone do pamięci RAM
  const layersInRam = numLayers - layersInVram;
  const ramRequired = layersInRam * memoryPerLayer;
  
  // Rezerwujemy 4.5 GB pamięci systemowej RAM na system Windows i inne procesy użytkownika
  const ramAvailableForModel = Math.max(0, totalRam - 4.5);
  const fitsInRam = ramRequired <= ramAvailableForModel;
  
  // Jeśli pozostałe warstwy nie mieszczą się w RAMie, następuje zrzucenie do pliku wymiany (swap na dysku)
  let layersInSwap = 0;
  if (!fitsInRam && ramAvailableForModel > 0) {
    const memoryFitsInRam = ramAvailableForModel;
    const layersThatFitInRam = Math.floor(memoryFitsInRam / memoryPerLayer);
    layersInSwap = numLayers - layersInVram - layersThatFitInRam;
  } else if (!fitsInRam) {
    layersInSwap = numLayers - layersInVram;
  }
  if (layersInSwap < 0) layersInSwap = 0;
  
  const layersInRamActual = numLayers - layersInVram - layersInSwap;

  // Obliczanie procentowego wskaźnika zgodności sprzętowej (Compatibility Score)
  let compatibilityScore;
  if (requiredMemory <= activeGpu.vram_gb) {
    // Model mieści się w całości w pamięci VRAM karty graficznej
    compatibilityScore = 100;
  } else if (requiredMemory <= (activeGpu.vram_gb + ramAvailableForModel)) {
    // Model mieści się w trybie hybrydowym (częściowo VRAM, częściowo RAM)
    const vramRatio = activeGpu.vram_gb / requiredMemory;
    compatibilityScore = Math.round(45 + vramRatio * 45); // Zakres 45% - 90%
  } else {
    // Model przekracza fizyczną pamięć, nastąpi zrzucanie na wolny dysk (swap)
    const totalAvailable = activeGpu.vram_gb + ramAvailableForModel;
    const ratio = totalAvailable / requiredMemory;
    compatibilityScore = Math.round(Math.max(10, ratio * 40)); // Zakres 10% - 40%
  }

  // 3. Prognozowanie szybkości generowania tekstu (Tokeny na sekundę)
  // Określenie mocy karty graficznej (klasy wydajnościowej GPU) na podstawie jej nazwy
  let gpuPower = 35; // Wartość bazowa dla układów zintegrowanych
  const gpuNameUpper = activeGpu.name.toUpperCase();
  if (gpuNameUpper.includes("RTX 4090") || gpuNameUpper.includes("RTX 3090")) gpuPower = 400;
  else if (gpuNameUpper.includes("RTX 4080") || gpuNameUpper.includes("RTX 3080") || gpuNameUpper.includes("RX 7900")) gpuPower = 280;
  else if (gpuNameUpper.includes("RTX 4070") || gpuNameUpper.includes("RTX 3070") || gpuNameUpper.includes("RTX 4060 Ti") || gpuNameUpper.includes("RX 7800")) gpuPower = 180;
  else if (gpuNameUpper.includes("RTX 4060") || gpuNameUpper.includes("RTX 3060") || gpuNameUpper.includes("RTX 2080") || gpuNameUpper.includes("RTX 3050") || gpuNameUpper.includes("RX 6600")) gpuPower = 110;
  else if (gpuNameUpper.includes("GTX 1660") || gpuNameUpper.includes("GTX 1080") || gpuNameUpper.includes("GTX 1070")) gpuPower = 70;
  else if (gpuNameUpper.includes("GTX 1650") || gpuNameUpper.includes("GTX 1060") || gpuNameUpper.includes("GTX 1050")) gpuPower = 45;

  const gpuTps = gpuPower / (model.sizeB * 1.1);
  const cpuTps = (cpuCores * 1.5) / (model.sizeB * 0.9 + 0.5);

  let estTps;
  if (layersInVram === numLayers) {
    estTps = gpuTps;
  } else if (layersInVram === 0) {
    estTps = cpuTps;
  } else {
    // Średnia ważona dla trybu hybrydowego
    const vramPct = layersInVram / numLayers;
    estTps = (gpuTps * vramPct) + (cpuTps * (1 - vramPct));
  }

  // Drastyczny spadek wydajności w przypadku korzystania z pamięci wirtualnej swap na dysku
  if (layersInSwap > 0) {
    const swapRatio = layersInSwap / numLayers;
    estTps = estTps * (1 - swapRatio * 0.95);
  }
  
  estTps = Math.round(Math.max(0.2, estTps) * 10) / 10;
  const displayTps = actualTps !== null ? actualTps : estTps;

  // Ustalenie statusu dopasowania oraz tekstu werdyktu w języku polskim
  let statusText;
  let statusColor;
  let statusBg;
  let verdictMessage;

  if (compatibilityScore >= 90) {
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
  const strokeDashoffset = circumference - (compatibilityScore / 100) * circumference;

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
              Rozmiar: {model.sizeB}B parametrów | Szacowane warstwy sieci: {model.layers}
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
                {compatibilityScore}%
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
              {Array.from({ length: numLayers }).map((_, idx) => {
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
              })}
            </div>

            {/* Legenda siatki offloadingu */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "16px", fontSize: "11px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "rgba(0, 229, 255, 0.25)", border: "1px solid var(--accent-cyan)" }}></span>
                <span>VRAM GPU ({layersInVram} warstw)</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "rgba(213, 0, 249, 0.25)", border: "1px solid var(--accent-purple)" }}></span>
                <span>RAM Systemowy ({layersInRamActual} warstw)</span>
              </span>
              {layersInSwap > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "rgba(255, 23, 68, 0.25)", border: "1px solid var(--accent-red)" }}></span>
                  <span style={{ color: "var(--accent-red)", fontWeight: "bold" }}>Spill / Swap ({layersInSwap} warstw) ⚠️</span>
                </span>
              )}
            </div>
          </div>

          <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
            Szacowany rozmiar modelu w pamięci: <strong style={{ color: "#fff" }}>{requiredMemory} GB</strong>. 
            Twoja wolna pamięć VRAM: <strong style={{ color: "var(--accent-cyan)" }}>{vramAvailable.toFixed(1)} GB</strong>.
            Wymagany RAM dla reszty warstw: <strong style={{ color: "var(--accent-purple)" }}>{ramRequired.toFixed(1)} GB</strong> (dostępne ok. {ramAvailableForModel.toFixed(1)} GB).
          </div>
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
                {layersInVram === numLayers ? (
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
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Posiadasz {totalRam} GB RAM</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                {requiredMemory <= totalRam ? (
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
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Wykryto {cpuCores} fizycznych rdzeni</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                {cpuCores >= 8 ? (
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
            {actualTps !== null ? "Rzeczywista szybkość generowania" : "Prognozowana szybkość generowania"}
          </h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", flexGrow: 1, justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", justifyContent: "center" }}>
              <span 
                style={{ 
                  fontSize: "48px", 
                  fontWeight: "900", 
                  fontFamily: "var(--font-mono)",
                  color: displayTps > 15 ? "var(--accent-green)" : displayTps > 7 ? "var(--accent-cyan)" : displayTps > 3 ? "var(--accent-amber)" : "var(--accent-red)"
                }}
              >
                {displayTps}
              </span>
              <span style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-secondary)" }}>t/s</span>
            </div>
            
            <div style={{ textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
              {actualTps !== null ? "Prędkość wnioskowania zmierzona podczas testu." : "Szacowana prędkość wnioskowania (Tokeny na sekundę)."}
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
                    color: displayTps >= 15 ? "var(--accent-green)" : displayTps >= 7 ? "var(--accent-cyan)" : displayTps >= 3 ? "var(--accent-amber)" : "var(--accent-red)" 
                  }}
                >
                  {displayTps >= 15 ? "Błyskawiczne" : displayTps >= 7 ? "Płynne czytanie" : displayTps >= 3 ? "Powolne" : "Uciążliwie wolne"}
                </strong>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
