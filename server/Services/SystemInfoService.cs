using System;
using System.Collections.Generic;
using System.Linq;
using System.Management;
using System.Runtime.InteropServices;
using Microsoft.Extensions.Logging;
using Microsoft.Win32;
using ProjektAI.Backend.Models;

namespace ProjektAI.Backend.Services
{
    /// <summary>
    /// Usługa systemowa odpowiedzialna za niskopoziomową telemetrię i zbieranie metryk sprzętowych.
    /// Integruje się z systemem operacyjnym Windows przy pomocy zapytań WMI (Windows Management Instrumentation),
    /// rejestru systemowego oraz narzędzia CLI sterownika graficznego (nvidia-smi).
    /// </summary>
    public class SystemInfoService
    {
        private readonly ILogger<SystemInfoService> _logger;
        private readonly SystemSpecs _cachedSpecs;

        /// <summary>
        /// Konstruktor inicjalizujący serwis telemetryczny. Pobiera jednorazowo statyczne parametry sprzętowe
        /// (model procesora, pamięć RAM, specyfikację GPU) i zapisuje je w pamięci podręcznej (cache),
        /// zapobiegając niepotrzebnemu obciążeniu systemu przy każdym zapytaniu.
        /// </summary>
        public SystemInfoService(ILogger<SystemInfoService> logger)
        {
            _logger = logger;
            _cachedSpecs = LoadStaticSpecs();
        }

        /// <summary>
        /// Pobiera zapamiętaną, statyczną specyfikację podzespołów komputera.
        /// </summary>
        public SystemSpecs GetStaticSpecs()
        {
            return _cachedSpecs;
        }

        /// <summary>
        /// Pobiera dynamiczne, aktualne obciążenie systemu (zużycie pamięci RAM w GB/procentach oraz
        /// procentowe obciążenie każdego logicznego rdzenia procesora w danej sekundzie).
        /// </summary>
        public LiveMetrics GetDynamicMetrics()
        {
            var metrics = new LiveMetrics();
            try
            {
                // 1. Pobieranie danych o pamięci RAM (Całkowita i Wolna pamięć)
                using (var searcher = new ManagementObjectSearcher("SELECT TotalVisibleMemorySize, FreePhysicalMemory FROM Win32_OperatingSystem"))
                using (var results = searcher.Get())
                {
                    foreach (var item in results)
                    {
                        double totalKb = Convert.ToDouble(item["TotalVisibleMemorySize"]);
                        double freeKb = Convert.ToDouble(item["FreePhysicalMemory"]);

                        double totalGb = Math.Round(totalKb / (1024.0 * 1024.0), 2);
                        double freeGb = Math.Round(freeKb / (1024.0 * 1024.0), 2);
                        double usedGb = Math.Round(totalGb - freeGb, 2);
                        double percent = Math.Round((usedGb / totalGb) * 100.0, 1);

                        metrics.RamUsedGb = usedGb;
                        metrics.RamAvailableGb = freeGb;
                        metrics.RamPercent = percent;
                    }
                }

                // 2. Pobieranie danych o zużyciu Procesora (CPU)
                using (var searcher = new ManagementObjectSearcher("SELECT Name, PercentProcessorTime FROM Win32_PerfFormattedData_PerfOS_Processor"))
                using (var results = searcher.Get())
                {
                    var cpuList = new List<(string Name, double Percent)>();
                    foreach (var item in results)
                    {
                        var name = item["Name"]?.ToString() ?? "";
                        var val = Convert.ToDouble(item["PercentProcessorTime"]);
                        cpuList.Add((name, val));
                    }

                    // Całkowite zużycie CPU (metoda _Total)
                    var totalCpu = cpuList.FirstOrDefault(c => c.Name == "_Total");
                    metrics.CpuPercent = totalCpu.Percent;

                    // Zużycie poszczególnych rdzeni/wątków CPU
                    var perCore = cpuList.Where(c => c.Name != "_Total")
                                         .OrderBy(c => int.TryParse(c.Name, out int idx) ? idx : 999)
                                         .Select(c => c.Percent)
                                         .ToList();
                    
                    metrics.CpuPercentPerCore = perCore;
                }

                // 3. Pobieranie danych o karcie graficznej NVIDIA (VRAM)
                try
                {
                    var gpuDict = GetNvidiaSmiAsync().GetAwaiter().GetResult();
                    if (gpuDict != null && gpuDict.ContainsKey("vram_used_mb") && gpuDict.ContainsKey("vram_total_mb"))
                    {
                        metrics.GpuVramUsedMb = gpuDict["vram_used_mb"];
                        metrics.GpuVramTotalMb = gpuDict["vram_total_mb"];
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Nie udało się pobrać danych GPU w GetDynamicMetrics: {Message}", ex.Message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Błąd podczas zbierania dynamicznych metryk systemu");
            }

            return metrics;
        }

        /// <summary>
        /// Cyklicznie próbkuje aktualne parametry fizyczne dedykowanej karty graficznej NVIDIA
        /// poprzez wywołanie systemowego procesu narzędziowego `nvidia-smi` z odpowiednimi parametrami zapytania.
        /// </summary>
        /// <returns>
        /// Słownik z kluczami reprezentującymi parametry GPU: vram_used_mb, vram_total_mb, gpu_util (obciążenie),
        /// power_draw (pobór mocy), power_limit (limit mocy), temperature (temperatura rdzenia).
        /// </returns>
        public async System.Threading.Tasks.Task<System.Collections.Generic.Dictionary<string, double>> GetNvidiaSmiAsync()
        {
            var result = new System.Collections.Generic.Dictionary<string, double>();
            try
            {
                // Zapytanie nvidia-smi o: użyty VRAM, całkowity VRAM, obciążenie GPU, pobór mocy, limit mocy, temperaturę
                var psi = new System.Diagnostics.ProcessStartInfo("nvidia-smi",
                    "--query-gpu=memory.used,memory.total,utilization.gpu,power.draw,power.limit,temperature.gpu --format=csv,noheader,nounits")
                {
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var process = System.Diagnostics.Process.Start(psi);
                if (process == null) return result;

                var output = await process.StandardOutput.ReadToEndAsync();
                await process.WaitForExitAsync();

                // Format wyjścia: "vram_used, vram_total, gpu_util, power_draw, power_limit, temp"
                var parts = output.Trim().Split(',');
                if (parts.Length >= 6)
                {
                    if (double.TryParse(parts[0].Trim(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double vramUsed))
                        result["vram_used_mb"] = vramUsed;
                    if (double.TryParse(parts[1].Trim(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double vramTotal))
                        result["vram_total_mb"] = vramTotal;
                    if (double.TryParse(parts[2].Trim(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double gpuUtil))
                        result["gpu_util"] = gpuUtil;
                    if (double.TryParse(parts[3].Trim(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double powerDraw))
                        result["power_draw"] = powerDraw;
                    if (double.TryParse(parts[4].Trim(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double powerLimit))
                        result["power_limit"] = powerLimit;
                    if (double.TryParse(parts[5].Trim(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double temp))
                        result["temperature"] = temp;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("nvidia-smi niedostępny lub wystąpił błąd: {Message}", ex.Message);
            }
            return result;
        }

        /// <summary>
        /// Wykonuje natychmiastową, uproszczoną migawkę obciążenia systemu (CPU i RAM).
        /// Używana do logowania stanu komputera tuż przed i tuż po zakończeniu testu wydajności.
        /// </summary>
        /// <returns>
        /// Krotka zawierająca: zużyty RAM (GB), całkowity RAM (GB), procent zużycia RAM (%) oraz procent obciążenia CPU (%).
        /// </returns>
        public (double ramUsedGb, double ramTotalGb, double ramPercent, double cpuPercent) GetSystemSnapshot()
        {
            double ramUsedGb = 0, ramTotalGb = 0, ramPercent = 0, cpuPercent = 0;
            try
            {
                using (var searcher = new ManagementObjectSearcher("SELECT TotalVisibleMemorySize, FreePhysicalMemory FROM Win32_OperatingSystem"))
                using (var results = searcher.Get())
                {
                    foreach (var item in results)
                    {
                        double totalKb = Convert.ToDouble(item["TotalVisibleMemorySize"]);
                        double freeKb = Convert.ToDouble(item["FreePhysicalMemory"]);
                        ramTotalGb = Math.Round(totalKb / (1024.0 * 1024.0), 2);
                        double freeGb = Math.Round(freeKb / (1024.0 * 1024.0), 2);
                        ramUsedGb = Math.Round(ramTotalGb - freeGb, 2);
                        ramPercent = Math.Round((ramUsedGb / ramTotalGb) * 100.0, 1);
                    }
                }

                using (var searcher = new ManagementObjectSearcher("SELECT Name, PercentProcessorTime FROM Win32_PerfFormattedData_PerfOS_Processor WHERE Name='_Total'"))
                using (var results = searcher.Get())
                {
                    foreach (var item in results)
                    {
                        cpuPercent = Convert.ToDouble(item["PercentProcessorTime"]);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Błąd podczas pobierania migawki systemowej: {Message}", ex.Message);
            }
            return (ramUsedGb, ramTotalGb, ramPercent, cpuPercent);
        }


        private SystemSpecs LoadStaticSpecs()
        {
            var specs = new SystemSpecs();

            // Nazwa i wersja systemu operacyjnego
            specs.Os = GetOsVersion();

            // Nazwa modelu procesora
            specs.CpuModel = GetCpuName();

            // Rdzenie logiczne i fizyczne procesora
            specs.CpuCoresLogical = Environment.ProcessorCount;
            specs.CpuCoresPhysical = GetPhysicalCpuCores();

            // Maksymalne taktowanie procesora
            specs.CpuMaxFrequencyMhz = GetCpuMaxFrequency();

            // Całkowita pamięć operacyjna RAM
            specs.RamTotalGb = GetTotalRamGb();

            // Informacje o kartach graficznych (GPU) i ich pamięci VRAM
            var (gpuNames, gpuDetails) = GetGpuInformation();
            specs.Gpus = gpuNames;
            specs.GpuDetails = gpuDetails;

            return specs;
        }

        // Odczytuje nazwę systemu operacyjnego
        private string GetOsVersion()
        {
            try
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    using (var searcher = new ManagementObjectSearcher("SELECT Caption, Version FROM Win32_OperatingSystem"))
                    using (var results = searcher.Get())
                    {
                        foreach (var item in results)
                        {
                            var caption = item["Caption"]?.ToString() ?? "Windows";
                            var version = item["Version"]?.ToString() ?? "";
                            return $"{caption} ({version})";
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Nie udało się pobrać wersji systemu operacyjnego przez WMI");
            }

            return RuntimeInformation.OSDescription;
        }

        // Odczytuje model procesora (najpierw z rejestru Windows, w razie błędu przez WMI)
        private string GetCpuName()
        {
            // Próba odczytu z Rejestru Systemowego (szybsze i dokładniejsze na Windowsie)
            try
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    using (var key = Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\CentralProcessor\0"))
                    {
                        var name = key?.GetValue("ProcessorNameString")?.ToString();
                        if (!string.IsNullOrEmpty(name))
                        {
                            return name.Trim();
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Nie udało się odczytać nazwy procesora z rejestru systemowego");
            }

            // Alternatywna próba przez zapytanie WMI
            try
            {
                using (var searcher = new ManagementObjectSearcher("SELECT Name FROM Win32_Processor"))
                using (var results = searcher.Get())
                {
                    foreach (var item in results)
                    {
                        var name = item["Name"]?.ToString();
                        if (!string.IsNullOrEmpty(name)) return name.Trim();
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Nie udało się odczytać nazwy procesora przez WMI");
            }

            return Environment.GetEnvironmentVariable("PROCESSOR_IDENTIFIER") ?? "Nieznany procesor";
        }

        // Pobiera liczbę fizycznych rdzeni procesora (nie wątków HT)
        private int GetPhysicalCpuCores()
        {
            try
            {
                int cores = 0;
                using (var searcher = new ManagementObjectSearcher("SELECT NumberOfCores FROM Win32_Processor"))
                using (var results = searcher.Get())
                {
                    foreach (var item in results)
                    {
                        cores += Convert.ToInt32(item["NumberOfCores"]);
                    }
                }
                if (cores > 0) return cores;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Nie udało się odczytać liczby fizycznych rdzeni procesora przez WMI");
            }

            // Domyślny szacunek (rdzenie logiczne / 2)
            return Math.Max(1, Environment.ProcessorCount / 2);
        }

        // Pobiera maksymalne taktowanie bazowe procesora (MHz)
        private double GetCpuMaxFrequency()
        {
            try
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    using (var key = Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\CentralProcessor\0"))
                    {
                        var mhzVal = key?.GetValue("~MHz");
                        if (mhzVal != null)
                        {
                            return Convert.ToDouble(mhzVal);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Nie udało się odczytać częstotliwości taktowania procesora z rejestru systemowego");
            }

            try
            {
                using (var searcher = new ManagementObjectSearcher("SELECT MaxClockSpeed FROM Win32_Processor"))
                using (var results = searcher.Get())
                {
                    foreach (var item in results)
                    {
                        return Convert.ToDouble(item["MaxClockSpeed"]);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Nie udało się odczytać częstotliwości taktowania procesora przez WMI");
            }

            return 0.0;
        }

        // Pobiera całkowitą pamięć RAM zainstalowaną w komputerze (w GB)
        private double GetTotalRamGb()
        {
            try
            {
                using (var searcher = new ManagementObjectSearcher("SELECT TotalVisibleMemorySize FROM Win32_OperatingSystem"))
                using (var results = searcher.Get())
                {
                    foreach (var item in results)
                    {
                        ulong kb = Convert.ToUInt64(item["TotalVisibleMemorySize"]);
                        return Math.Round((double)kb / (1024.0 * 1024.0), 2);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Nie udało się odczytać całkowitej pamięci RAM przez WMI");
            }

            return 0.0;
        }

        // Odczytuje dokładną pojemność VRAM z rejestru systemowego Windows (QWORD 64-bit), omijając limit 4GB w WMI.
        private double GetVramFromRegistry(string gpuName)
        {
            try
            {
                string keyPath = @"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}";
                using (var rootKey = Registry.LocalMachine.OpenSubKey(keyPath))
                {
                    if (rootKey != null)
                    {
                        foreach (string subKeyName in rootKey.GetSubKeyNames())
                        {
                            if (subKeyName.Length == 4) // Np. 0000, 0001
                            {
                                using (var subKey = rootKey.OpenSubKey(subKeyName))
                                {
                                    if (subKey != null)
                                    {
                                        var desc = subKey.GetValue("DriverDesc")?.ToString();
                                        if (desc != null && (desc.Contains(gpuName, StringComparison.OrdinalIgnoreCase) || gpuName.Contains(desc, StringComparison.OrdinalIgnoreCase)))
                                        {
                                            // Próba odczytu wartości 64-bitowej
                                            var qwMem = subKey.GetValue("HardwareInformation.qwMemorySize");
                                            if (qwMem != null)
                                            {
                                                double bytes = Convert.ToDouble(qwMem);
                                                return Math.Round(bytes / (1024.0 * 1024.0 * 1024.0), 2);
                                            }

                                            // Fallback do wartości 32-bitowej
                                            var mem = subKey.GetValue("HardwareInformation.MemorySize");
                                            if (mem != null)
                                            {
                                                double bytes = Convert.ToDouble(mem);
                                                return Math.Round(bytes / (1024.0 * 1024.0 * 1024.0), 2);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Nie udało się odczytać VRAM z rejestru dla GPU: {GpuName}", gpuName);
            }
            return 0.0;
        }

        // Pobiera pojemność pamięci VRAM dedykowanej karty graficznej NVIDIA przy pomocy narzędzia nvidia-smi.
        private double GetNvidiaVramFromSmi()
        {
            try
            {
                var psi = new System.Diagnostics.ProcessStartInfo("nvidia-smi",
                    "--query-gpu=memory.total --format=csv,noheader,nounits")
                {
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var process = System.Diagnostics.Process.Start(psi);
                if (process != null)
                {
                    var output = process.StandardOutput.ReadToEnd();
                    process.WaitForExit();
                    var parts = output.Trim().Split('\n');
                    if (parts.Length > 0 && double.TryParse(parts[0].Trim(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double mib))
                    {
                        return Math.Round(mib / 1024.0, 2); // Konwersja z MiB do GB
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("nvidia-smi nie powiodło się przy odpytywaniu o VRAM: {Message}", ex.Message);
            }
            return 0.0;
        }

        // Zwraca listę nazw kart graficznych oraz szczegółowe informacje (nazwa i ilość VRAM)
        private (List<string> Names, List<GpuDetail> Details) GetGpuInformation()
        {
            var names = new List<string>();
            var details = new List<GpuDetail>();

            try
            {
                using (var searcher = new ManagementObjectSearcher("SELECT Name, AdapterRAM FROM Win32_VideoController"))
                using (var results = searcher.Get())
                {
                    foreach (var item in results)
                    {
                        var name = item["Name"]?.ToString() ?? "Nieznana karta graficzna";
                        double vramGb = 0.0;

                        // 1. Spróbujmy odczytać WMI
                        var adapterRam = item["AdapterRAM"];
                        if (adapterRam != null)
                        {
                            try
                            {
                                long bytesSigned = Convert.ToInt64(adapterRam);
                                ulong bytes = bytesSigned < 0 ? (ulong)(bytesSigned + 4294967296L) : (ulong)bytesSigned;
                                vramGb = Math.Round((double)bytes / (1024.0 * 1024.0 * 1024.0), 2);
                            }
                            catch (Exception ramEx)
                            {
                                _logger.LogWarning(ramEx, "Nie udało się sparsować wartości AdapterRAM dla karty graficznej");
                            }
                        }

                        // 2. Jeśli to karta NVIDIA, spróbuj pobrać dokładny VRAM z nvidia-smi
                        if (name.Contains("NVIDIA", StringComparison.OrdinalIgnoreCase))
                        {
                            double smiVram = GetNvidiaVramFromSmi();
                            if (smiVram > 0)
                            {
                                vramGb = smiVram;
                            }
                        }

                        // 3. Fallback do rejestru systemowego Windows (często wymagany, gdyż WMI dla GTX 1650/1060 w systemach hybrydowych zgłasza 0)
                        if (vramGb <= 0.1)
                        {
                            double regVram = GetVramFromRegistry(name);
                            if (regVram > 0)
                            {
                                vramGb = regVram;
                            }
                        }

                        names.Add(name);
                        details.Add(new GpuDetail { Name = name, VramGb = vramGb });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Nie udało się odczytać informacji o karcie graficznej przez WMI");
            }

            // Jeśli nie wykryto żadnej karty, wstawiamy wartość zastępczą
            if (names.Count == 0)
            {
                names.Add("Nieznana karta graficzna (lub tylko zintegrowany układ graficzny)");
                details.Add(new GpuDetail { Name = "Nieznana karta GPU", VramGb = 0.0 });
            }

            return (names, details);
        }
    }
}
