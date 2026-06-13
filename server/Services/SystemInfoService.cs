using System;
using System.Collections.Generic;
using System.Linq;
using System.Management;
using System.Runtime.InteropServices;
using Microsoft.Extensions.Logging;
using Microsoft.Win32;
using NeuroBench.Backend.Models;

namespace NeuroBench.Backend.Services
{
    public class SystemInfoService
    {
        private readonly ILogger<SystemInfoService> _logger;
        private readonly SystemSpecs _cachedSpecs;

        public SystemInfoService(ILogger<SystemInfoService> logger)
        {
            _logger = logger;
            _cachedSpecs = LoadStaticSpecs();
        }

        public SystemSpecs GetStaticSpecs()
        {
            return _cachedSpecs;
        }

        public LiveMetrics GetDynamicMetrics()
        {
            var metrics = new LiveMetrics();
            try
            {
                // 1. Memory Usage
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

                // 2. CPU Usage
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

                    // Total CPU
                    var totalCpu = cpuList.FirstOrDefault(c => c.Name == "_Total");
                    metrics.CpuPercent = totalCpu.Percent;

                    // Per-core CPU
                    var perCore = cpuList.Where(c => c.Name != "_Total")
                                         .OrderBy(c => int.TryParse(c.Name, out int idx) ? idx : 999)
                                         .Select(c => c.Percent)
                                         .ToList();
                    
                    metrics.CpuPercentPerCore = perCore;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error gathering live system metrics");
            }

            return metrics;
        }

        private SystemSpecs LoadStaticSpecs()
        {
            var specs = new SystemSpecs();

            // OS
            specs.Os = GetOsVersion();

            // CPU Name
            specs.CpuModel = GetCpuName();

            // CPU Cores
            specs.CpuCoresLogical = Environment.ProcessorCount;
            specs.CpuCoresPhysical = GetPhysicalCpuCores();

            // CPU Max Freq
            specs.CpuMaxFrequencyMhz = GetCpuMaxFrequency();

            // Total RAM
            specs.RamTotalGb = GetTotalRamGb();

            // GPUs and GPU Details
            var (gpuNames, gpuDetails) = GetGpuInformation();
            specs.Gpus = gpuNames;
            specs.GpuDetails = gpuDetails;

            return specs;
        }

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
                _logger.LogWarning(ex, "Could not get OS version via WMI");
            }

            return RuntimeInformation.OSDescription;
        }

        private string GetCpuName()
        {
            // Try Registry first
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
                _logger.LogWarning(ex, "Could not read CPU name from registry");
            }

            // Fallback to WMI
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
                _logger.LogWarning(ex, "Could not read CPU name from WMI");
            }

            return Environment.GetEnvironmentVariable("PROCESSOR_IDENTIFIER") ?? "Unknown CPU";
        }

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
                _logger.LogWarning(ex, "Could not read CPU physical cores from WMI");
            }

            // Fallback guess
            return Math.Max(1, Environment.ProcessorCount / 2);
        }

        private double GetCpuMaxFrequency()
        {
            // Try Registry first
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
                _logger.LogWarning(ex, "Could not read CPU frequency from registry");
            }

            // Fallback WMI
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
                _logger.LogWarning(ex, "Could not read CPU frequency from WMI");
            }

            return 0.0;
        }

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
                _logger.LogWarning(ex, "Could not read Total RAM from WMI");
            }

            return 0.0;
        }

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
                        var name = item["Name"]?.ToString() ?? "Unknown GPU";
                        double vramGb = 0.0;

                        var adapterRam = item["AdapterRAM"];
                        if (adapterRam != null)
                        {
                            try
                            {
                                long bytesSigned = Convert.ToInt64(adapterRam);
                                ulong bytes;
                                if (bytesSigned < 0)
                                {
                                    // Handle overflow for 32-bit queries on systems with large VRAM (VRAM + 4GB)
                                    bytes = (ulong)(bytesSigned + 4294967296L);
                                }
                                else
                                {
                                    bytes = (ulong)bytesSigned;
                                }

                                vramGb = Math.Round((double)bytes / (1024.0 * 1024.0 * 1024.0), 2);
                            }
                            catch (Exception ramEx)
                            {
                                _logger.LogWarning(ramEx, "Failed to parse AdapterRAM");
                            }
                        }

                        names.Add(name);
                        details.Add(new GpuDetail { Name = name, VramGb = vramGb });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not read GPU information from WMI");
            }

            if (names.Count == 0)
            {
                names.Add("Unknown GPU (or Integrated Graphics Only)");
                details.Add(new GpuDetail { Name = "Unknown GPU", VramGb = 0.0 });
            }

            return (names, details);
        }
    }
}
