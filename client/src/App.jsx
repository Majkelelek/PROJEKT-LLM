import { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import BenchmarkPanel from "./components/BenchmarkPanel";
import AIAnalyst from "./components/AIAnalyst";
import HistoryPanel from "./components/HistoryPanel";
import ComparePanel from "./components/ComparePanel";
import LoadingView from "./components/LoadingView";
import OfflineView from "./components/OfflineView";
import Sidebar from "./components/Sidebar";
import { API_URL } from "./config";
import "./App.css";

export default function App() {
  // --- Stany globalne aplikacji ---
  const [activeTab, setActiveTab] = useState("dashboard"); // Aktualnie wybrana zakładka w menu bocznym
  const [specs, setSpecs] = useState(null); // Statyczna specyfikacja sprzętowa komputera
  const [liveMetrics, setLiveMetrics] = useState(null); // Dynamiczne metryki obciążenia CPU/RAM pobrane na starcie
  const [ollamaActive, setOllamaActive] = useState(false); // Czy lokalne API Ollama jest aktywne
  const [models, setModels] = useState([]); // Lista dostępnych modeli w usłudze Ollama
  
  const [activeRun, setActiveRun] = useState(null); // Aktualnie przeglądany przebieg benchmarku (do wyświetlenia w Dashboard/AIAnalyst)
  const [backendError, setBackendError] = useState(false); // Flaga informująca o braku połączenia z backendem .NET
  const [loading, setLoading] = useState(true); // Status ładowania początkowych danych aplikacji

  // Funkcja pobierająca wstępne dane przy uruchomieniu aplikacji (specyfikację sprzętową, status Ollamy i historię z przeglądarki)
  const fetchInitialData = async () => {
    setLoading(true);
    setBackendError(false);
    try {
      // 1. Pobieranie danych o systemie i aktualnych metrykach z backendu
      const systemRes = await fetch(`${API_URL}/api/system-info`);
      if (!systemRes.ok) throw new Error("Błąd API informacji o systemie backendu");
      const systemData = await systemRes.json();
      setSpecs(systemData.specs);
      setLiveMetrics(systemData.live_metrics);

      // 2. Pobieranie statusu i listy modeli z usługi Ollama poprzez backend
      const ollamaRes = await fetch(`${API_URL}/api/models`);
      if (ollamaRes.ok) {
        const ollamaData = await ollamaRes.json();
        setOllamaActive(ollamaData.ollama_active);
        setModels(ollamaData.models);
      }
      
      // 3. Odczytywanie historii testów z pamięci lokalnej przeglądarki (localStorage)
      try {
        const localData = localStorage.getItem("projekt_ai_history");
        const reportsData = localData ? JSON.parse(localData) : [];
        if (reportsData.length > 0) {
          // Ujednolicanie starych/niekompletnych wpisów z historii (brak id lub complexity)
          let modified = false;
          const sanitized = reportsData.map((run, idx) => {
            const runId = run.id || run.Id;
            const hasComplexity = run.complexity;
            if (!runId || !hasComplexity) {
              modified = true;
              return {
                ...run,
                id: runId || `run-legacy-${idx}-${new Date(run.timestamp || Date.now()).getTime()}`,
                complexity: run.complexity || "medium"
              };
            }
            return run;
          });

          if (modified) {
            localStorage.setItem("projekt_ai_history", JSON.stringify(sanitized));
          }

          // Sortowanie według daty i ustawienie najnowszego testu jako aktywnego
          const sorted = sanitized.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setActiveRun(sorted[0]);
        }
      } catch (e) {
        console.error("Nie udało się sparsować historii z localStorage:", e);
      }
    } catch (err) {
      console.error("Nie udało się połączyć z backendem ASP.NET Core:", err);
      setBackendError(true);
    } finally {
      setLoading(false);
    }
  };

  // Cykliczne sprawdzanie połączenia z serwerem i Ollamą w tle (co 5 sekund)
  const checkConnection = async () => {
    try {
      const ollamaRes = await fetch(`${API_URL}/api/models`);
      if (ollamaRes.ok) {
        const ollamaData = await ollamaRes.json();
        setOllamaActive(ollamaData.ollama_active);
        setModels(ollamaData.models);
        setBackendError(false);
      } else {
        setOllamaActive(false);
      }
    } catch (err) {
      console.error("Utracono połączenie z backendem:", err);
      setOllamaActive(false);
      setBackendError(true);
    }
  };

  // Efekt uruchamiający początkowe pobieranie danych i rejestrujący interwał sprawdzania połączenia
  useEffect(() => {
    setTimeout(() => {
      fetchInitialData();
    }, 0);
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  // Obsługa zakończenia nowego testu wydajnościowego
  const handleBenchmarkComplete = (completedRun) => {
    try {
      const localData = localStorage.getItem("projekt_ai_history");
      const data = localData ? JSON.parse(localData) : [];
      data.push(completedRun);
      // Zapisujemy nowy wynik w pamięci przeglądarki (localStorage)
      localStorage.setItem("projekt_ai_history", JSON.stringify(data));
    } catch (e) {
      console.error("Nie udało się zapisać przebiegu testu w localStorage:", e);
    }
    
    // Ustawiamy ten bieg jako aktywny i przełączamy automatycznie na kartę szczegółowych wyników
    setActiveRun(completedRun);
    setActiveTab("analysis");
  };

  // Obsługa wybrania historycznego rekordu z tabeli wyników
  const handleSelectHistoryRun = (run) => {
    setActiveRun(run);
    setActiveTab("analysis"); // Ładujemy szczegółowe metryki wczytanego testu
  };

  // Ekran błędu - serwer backend offline
  if (backendError) {
    return <OfflineView onRetry={fetchInitialData} />;
  }

  // Ekran ładowania - inicjalizacja danych
  if (loading) {
    return <LoadingView />;
  }

  // Główny layout i router paneli interfejsu
  return (
    <div className="app-container">
      {/* Panel boczny nawigacji */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        ollamaActive={ollamaActive} 
        modelsCount={models.length} 
      />

      {/* Główna sekcja zawartości strony */}
      <main className="app-content">
        <header className="page-header">
          <div className="header-title">
            <h1>
              {activeTab === "dashboard" && "Panel Systemu"}
              {activeTab === "benchmark" && "Zestaw Testów Wydajności"}
              {activeTab === "analysis" && "Szczegółowe Wyniki Testu"}
              {activeTab === "compare" && "Porównanie Wyników"}
              {activeTab === "history" && "Logi Wyników Wydajności"}
            </h1>
            <span className="header-subtitle">
              {activeTab === "dashboard" && "Śledzenie specyfikacji w czasie rzeczywistym i telemetria zasobów."}
              {activeTab === "benchmark" && "Uruchom test wydajności lokalnych modeli językowych (LLM)."}
              {activeTab === "analysis" && "Szczegółowe wyniki pomiarów wydajności oraz analiza alokacji pamięci."}
              {activeTab === "compare" && "Zestaw ze sobą dwa testy, aby bezpośrednio porównać ich wydajność i parametry."}
              {activeTab === "history" && "Przeglądaj historię wyników, eksportuj i usuwaj wpisy."}
            </span>
          </div>
        </header>

        {/* Renderowanie poszczególnych widoków w zależności od wybranej zakładki */}
        {activeTab === "dashboard" && (
          <Dashboard 
            specs={specs} 
            liveMetrics={liveMetrics} 
            onRunBenchmarkTab={() => setActiveTab("benchmark")} 
          />
        )}

        {activeTab === "benchmark" && (
          <BenchmarkPanel 
            ollamaActive={ollamaActive} 
            models={models} 
            onBenchmarkComplete={handleBenchmarkComplete} 
          />
        )}

        {activeTab === "analysis" && (
          <AIAnalyst 
            currentRun={activeRun} 
          />
        )}

        {activeTab === "compare" && (
          <ComparePanel />
        )}

        {activeTab === "history" && (
          <HistoryPanel 
            onSelectRun={handleSelectHistoryRun} 
            activeRunId={activeRun?.id} 
          />
        )}
      </main>
    </div>
  );
}
