// Komponent Sidebar reprezentujący boczny pasek nawigacyjny oraz indykator statusu połączenia z Ollamą.
export default function Sidebar({ activeTab, onTabChange, ollamaActive, modelsCount }) {
  return (
    <aside className="app-sidebar">
      {/* Nagłówek logo aplikacji */}
      <div className="sidebar-logo">
        <div className="logo-icon">P</div>
        <span className="logo-text">Projekt AI</span>
      </div>

      {/* Menu nawigacyjne wyboru paneli */}
      <nav className="sidebar-nav">
        <button 
          className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => onTabChange("dashboard")}
        >
          📊 Specyfikacja
        </button>
        <button 
          className={`nav-item ${activeTab === "benchmark" ? "active" : ""}`}
          onClick={() => onTabChange("benchmark")}
        >
          🚀 Uruchom testy
        </button>
        <button 
          className={`nav-item ${activeTab === "analysis" ? "active" : ""}`}
          onClick={() => onTabChange("analysis")}
        >
          📊 Wyniki testu
        </button>
        <button 
          className={`nav-item ${activeTab === "compare" ? "active" : ""}`}
          onClick={() => onTabChange("compare")}
        >
          ⚖️ Porównaj wyniki
        </button>
        <button 
          className={`nav-item ${activeTab === "history" ? "active" : ""}`}
          onClick={() => onTabChange("history")}
        >
          📁 Zapisane wyniki
        </button>
      </nav>

      {/* Stopka panelu bocznego wyświetlająca status podłączenia lokalnej usługi Ollama */}
      <div className="sidebar-footer">
        <div className="ollama-status-card">
          <span className={`status-indicator ${ollamaActive ? "online" : "offline"}`}></span>
          <div>
            <div style={{ fontWeight: "600" }}>Lokalne API Ollama</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {ollamaActive ? `Online (modele: ${modelsCount})` : "Offline"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
