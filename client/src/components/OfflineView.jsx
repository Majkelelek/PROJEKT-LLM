// Komponent OfflineView wyświetlający ekran diagnostyczny w przypadku braku połączenia z backendem .NET.
export default function OfflineView({ onRetry }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "var(--bg-primary)", gap: "20px", padding: "20px", textAlign: "center" }}>
      <div style={{ fontSize: "64px" }}>🔌</div>
      <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--accent-red)" }}>
        Backend Projekt AI jest Offline
      </h1>
      <p style={{ color: "var(--text-secondary)", maxWidth: "500px", lineHeight: "1.6" }}>
        Nie udało się nawiązać połączenia z serwerem ASP.NET Core (.NET 8). Upewnij się, że serwer działa na lokalnym porcie 8000.
      </p>
      {/* Kod pomocniczy ułatwiający użytkownikowi uruchomienie serwera z konsoli */}
      <div style={{ padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "8px", fontFamily: "var(--font-mono)", fontSize: "14px", color: "var(--accent-cyan)", textAlign: "left" }}>
        # Jak uruchomić backend:<br />
        cd server<br />
        dotnet run
      </div>
      <button className="btn btn-primary" onClick={onRetry} style={{ marginTop: "10px" }}>
        🔄 Spróbuj ponownie
      </button>
    </div>
  );
}
