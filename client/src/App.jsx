import React, { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import BenchmarkPanel from "./components/BenchmarkPanel";
import AIAnalyst from "./components/AIAnalyst";
import HistoryPanel from "./components/HistoryPanel";
import "./App.css";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [specs, setSpecs] = useState(null);
  const [liveMetrics, setLiveMetrics] = useState(null);
  const [ollamaActive, setOllamaActive] = useState(false);
  const [models, setModels] = useState([]);
  
  const [activeRun, setActiveRun] = useState(null);
  const [backendError, setBackendError] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchInitialData = async () => {
    setLoading(true);
    setBackendError(false);
    try {
      // 1. Fetch system static & live metrics
      const systemRes = await fetch("http://127.0.0.1:8000/api/system-info");
      if (!systemRes.ok) throw new Error("Backend system info API error");
      const systemData = await systemRes.json();
      setSpecs(systemData.specs);
      setLiveMetrics(systemData.live_metrics);

      // 2. Fetch Ollama details
      const ollamaRes = await fetch("http://127.0.0.1:8000/api/models");
      if (ollamaRes.ok) {
        const ollamaData = await ollamaRes.json();
        setOllamaActive(ollamaData.ollama_active);
        setModels(ollamaData.models);
      }
      
      // 3. Get past runs from localStorage to set the most recent run as default view
      try {
        const localData = localStorage.getItem("neurobench_history");
        const reportsData = localData ? JSON.parse(localData) : [];
        if (reportsData.length > 0) {
          // Sort and set newest
          const sorted = reportsData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setActiveRun(sorted[0]);
        }
      } catch (e) {
        console.error("Failed to parse localStorage history:", e);
      }
    } catch (err) {
      console.error("Failed to connect to ASP.NET Core backend:", err);
      setBackendError(true);
    } finally {
      setLoading(false);
    }
  };

  const checkConnection = async () => {
    try {
      const ollamaRes = await fetch("http://127.0.0.1:8000/api/models");
      if (ollamaRes.ok) {
        const ollamaData = await ollamaRes.json();
        setOllamaActive(ollamaData.ollama_active);
        setModels(ollamaData.models);
        setBackendError(false);
      } else {
        setOllamaActive(false);
      }
    } catch (err) {
      console.error("Backend connection lost:", err);
      setOllamaActive(false);
      setBackendError(true);
    }
  };

  useEffect(() => {
    fetchInitialData();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleBenchmarkComplete = (completedRun) => {
    try {
      const localData = localStorage.getItem("neurobench_history");
      const data = localData ? JSON.parse(localData) : [];
      data.push(completedRun);
      localStorage.setItem("neurobench_history", JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save run to localStorage:", e);
    }
    
    setActiveRun(completedRun);
    // Automatically switch to AI analysis tab to show the report!
    setActiveTab("analysis");
  };

  const handleSelectHistoryRun = (run) => {
    setActiveRun(run);
    setActiveTab("dashboard"); // load specs details and jump back
  };

  if (backendError) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "var(--bg-primary)", gap: "20px", padding: "20px", textAlign: "center" }}>
        <div style={{ fontSize: "64px" }}>🔌</div>
        <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--accent-red)" }}>NeuroBench Backend jest Offline</h1>
        <p style={{ color: "var(--text-secondary)", maxWidth: "500px", lineHeight: "1.6" }}>
          Nie udało się nawiązać połączenia z serwerem ASP.NET Core (.NET 8). Upewnij się, że serwer działa na lokalnym porcie 8000.
        </p>
        <div style={{ padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "8px", fontFamily: "var(--font-mono)", fontSize: "14px", color: "var(--accent-cyan)", textAlign: "left" }}>
          # Jak uruchomić backend:<br />
          cd server<br />
          dotnet run
        </div>
        <button className="btn btn-primary" onClick={fetchInitialData} style={{ marginTop: "10px" }}>
          🔄 Spróbuj ponownie
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "var(--bg-primary)", gap: "16px" }}>
        <div className="spinner spinner-large glowing-text-cyan"></div>
        <div style={{ fontSize: "16px", color: "var(--text-secondary)", fontWeight: "500" }}>Inicjalizacja Panelu NeuroBench AI...</div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">N</div>
          <span className="logo-text">NeuroBench AI</span>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            📊 Specyfikacja
          </button>
          <button 
            className={`nav-item ${activeTab === "benchmark" ? "active" : ""}`}
            onClick={() => setActiveTab("benchmark")}
          >
            🚀 Uruchom testy
          </button>
          <button 
            className={`nav-item ${activeTab === "analysis" ? "active" : ""}`}
            onClick={() => setActiveTab("analysis")}
          >
            🧠 Raport analityka AI
          </button>
          <button 
            className={`nav-item ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            📁 Zapisane wyniki
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="ollama-status-card">
            <span className={`status-indicator ${ollamaActive ? "online" : "offline"}`}></span>
            <div>
              <div style={{ fontWeight: "600" }}>Lokalne API Ollama</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {ollamaActive ? `Online (modele: ${models.length})` : "Offline"}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="app-content">
        <header className="page-header">
          <div className="header-title">
            <h1>
              {activeTab === "dashboard" && "Panel Systemu"}
              {activeTab === "benchmark" && "Zestaw Testów Wydajności"}
              {activeTab === "analysis" && "Ekspercka Ocena AI"}
              {activeTab === "history" && "Logi Wyników Wydajności"}
            </h1>
            <span className="header-subtitle">
              {activeTab === "dashboard" && "Śledzenie specyfikacji w czasie rzeczywistym i telemetria zasobów."}
              {activeTab === "benchmark" && "Uruchom test wydajności lokalnych modeli językowych (LLM)."}
              {activeTab === "analysis" && "Raport o wąskich gardłach wydajności i rekomendacje uaktualnień przygotowane przez LLM Ollama."}
              {activeTab === "history" && "Przeglądaj historię wyników, eksportuj i usuwaj wpisy."}
            </span>
          </div>
        </header>

        {/* Tab view routing */}
        {activeTab === "dashboard" && (
          <Dashboard 
            specs={activeRun?.specs || specs} 
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
