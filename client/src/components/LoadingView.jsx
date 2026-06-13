// Komponent LoadingView wyświetlający ekran ładowania podczas inicjalizacji aplikacji.
export default function LoadingView() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "var(--bg-primary)", gap: "16px" }}>
      {/* Duży animowany wskaźnik ładowania */}
      <div className="spinner spinner-large glowing-text-cyan"></div>
      <div style={{ fontSize: "16px", color: "var(--text-secondary)", fontWeight: "500" }}>
        Inicjalizacja Panelu...
      </div>
    </div>
  );
}
