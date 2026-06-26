# Lokalny System Benchmarkingu i Telemetrii LLM (.NET + React)

Narzędzie do lokalnego testowania wydajności dużych modeli językowych (LLM) zintegrowane z zaawansowaną telemetrią sprzętową w czasie rzeczywistym. System łączy backend napisany w **ASP.NET Core 8** z responsywnym panelem użytkownika w technologii **React**.

---

##  Architektura i Technologia

Projekt opiera się na architekturze typu *Local-Only Execution*, gwarantując pełną prywatność danych i niezależność od chmury.

* **Backend (ASP.NET Core 8 Web API)**:
  * `SystemInfoService` – niskopoziomowa telemetria systemu Windows (rdzenie CPU, RAM) oparta na zapytaniach **WMI** oraz bezpośrednia integracja z **`nvidia-smi`** w celu monitorowania temperatury, poboru mocy i obciążenia VRAM kart graficznych NVIDIA.
  * `OllamaClientService` – asynchroniczny klient komunikujący się z lokalnym demonem Ollama API (`localhost:11434`).
  * **Server-Sent Events (SSE)** – strumieniowanie postępów testów i logów do przeglądarki w czasie rzeczywistym za pomocą punktu `/api/benchmark/run-stream`.
* **Frontend (React + Vanilla CSS)**:
  * **Sleek Dark Mode** – nowoczesny interfejs z dynamicznymi animacjami i pełną responsywnością (RWD).
  * Wizualizacja obciążenia sprzętu za pomocą responsywnych wykresów i wskaźników SVG rysowanych w czasie rzeczywistym.

---

##  Kluczowe Funkcjonalności

1. **Monitorowanie Live (Dashboard)**:
   * Podgląd parametrów procesora (z podziałem na rdzenie fizyczne), RAM oraz dedykowanej karty graficznej (obciążenie GPU, zużycie VRAM, temperatury, zasilanie).
2. **Benchmark LLM (Benchmark Panel)**:
   * Testy szybkości generowania tekstu (mierzone w **tokenach na sekundę - t/s**), opóźnienia do pierwszego tokenu (**TTFT**) oraz stabilności temperaturowo-energetycznej sprzętu.
3. **Kalkulator Zgodności (Compatibility)**:
   * Narzędzie szacujące stopień alokacji modelu w pamięci VRAM oraz RAM. Wizualizuje offload warstw i ostrzega o ryzyku spadku wydajności.
4. **Porównywarka i Historia (Compare & History)**:
   * Zapisywanie wyników w `localStorage`, eksport raportów do formatów Markdown i JSON oraz zestawianie wyników dwóch testów obok siebie w celu analizy wydajności.
5. **Analiza AI (AI Analyst)**:
   * Wykorzystanie lokalnego modelu do automatycznej analizy danych pomiarowych i generowania raportu podsumowującego profil wydajnościowy platformy.

---

##  Instrukcja Uruchomienia

### Wymagania wstępne
* **System operacyjny**: Windows (wymagany do telemetrii WMI oraz `nvidia-smi`)
* **SDK**: .NET 8.0 SDK
* **Środowisko uruchomieniowe**: Node.js (wersja 18+) i npm
* **Silnik LLM**: Uruchomiona lokalna usługa [Ollama](https://ollama.com/) z pobranymi modelami (np. `llama3.2`, `gemma2:2b`, etc.)

### 1. Uruchomienie Serwera (Backend)
1. Przejdź do folderu `server`:
   ```bash
   cd server
   ```
2. Uruchom projekt:
   ```bash
   dotnet run
   ```
Serwer domyślnie nasłuchuje na adresie `http://127.0.0.1:8000`.

### 2. Uruchomienie Klienta (Frontend)
1. Przejdź do folderu `client`:
   ```bash
   cd client
   ```
2. Zainstaluj zależności:
   ```bash
   npm install
   ```
3. Uruchom serwer deweloperski:
   ```bash
   npm run dev
   ```
Aplikacja otworzy się pod domyślnym adresem Vite (np. `http://localhost:5173`).

---

##  Autorzy

Projekt został stworzony przez:

* **Michał Korba** 
* **Hanna Gościniak** 
* **Dominik Pryca** 
* **Filip Kaczor** 
* **Mikołaj Hejnosz** 


---



