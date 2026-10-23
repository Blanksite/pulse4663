"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ArrowRight,
  RefreshCw,
  Send,
} from "lucide-react";
import {
  PULSE_4663_PRESETS,
  ROBINHOOD_CHAIN_CONFIG,
  RobinhoodLiveOnChainData,
  V4StackContractInfo,
} from "@/lib/robinhood-rpc";
import {
  HookBitmaskReport,
  UNISWAP_V4_PERMISSION_DEFS,
} from "@/lib/v4-bitmask";
import { PulseSecurityVerdict } from "@/lib/venice-audit";

interface ScanApiResponse {
  timestamp: string;
  presetUsed: string;
  bitmaskReport: HookBitmaskReport;
  onChainData: RobinhoodLiveOnChainData;
  v4StackStatus: {
    blockNumber: number;
    contracts: V4StackContractInfo[];
  };
  securityVerdict: PulseSecurityVerdict;
}

interface AgentMessage {
  role: "user" | "agent";
  text: string;
  blockNumber?: number;
  latencyMs?: number;
}

const FRIENDLY_PRESETS = [
  {
    id: "live-hookdeploy-token",
    labelId: "Token $HOOKDEPLOY (Live di Robinhood Chain)",
    labelEn: "$HOOKDEPLOY Token (Live on Robinhood Chain)",
    tagId: "Aman • Token Asli",
    tagEn: "Safe • Live Token",
    descId:
      "Contoh cek token asli yang sudah rilis di jaringan Robinhood Chain. Menampilkan total suplai & jumlah token yang sudah di-burn.",
    descEn:
      "Inspect a real token live on Robinhood Chain. Shows total supply, burned tokens, and contract safety.",
    tone: "safe" as const,
  },
  {
    id: "safe-dynamic-fee-hook",
    labelId: "Pool Trading Wajar (Biaya Dinamis)",
    labelEn: "Standard Trading Pool (Dynamic Fee)",
    tagId: "Aman Dibeli",
    tagEn: "Safe to Trade",
    descId:
      "Pool ini hanya menyesuaikan biaya admin saat pasar ramai, tapi TIDAK BISA mengambil atau mengunci uangmu.",
    descEn:
      "This pool adjusts trading fees during volatility, but CANNOT steal your balance or lock your funds.",
    tone: "safe" as const,
  },
  {
    id: "warning-uncapped-tax-hook",
    labelId: "Pool dengan Potongan Pajak Tambahan",
    labelEn: "Pool with Custom Output Tax",
    tagId: "Waspada Pajak",
    tagEn: "Caution: Tax",
    descId:
      "Pool ini memiliki aturan yang bisa memotong sebagian koin hasil pembelianmu sebagai pajak tambahan.",
    descEn:
      "This pool has a rule that can deduct an extra fee from the coins you receive when swapping.",
    tone: "warn" as const,
  },
  {
    id: "critical-delta-drainer-hook",
    labelId: "Pool Jebakan / Honeypot (Penyedot Saldo)",
    labelEn: "Honeypot / Wallet Drainer Pool",
    tagId: "Bahaya • Jangan Beli",
    tagEn: "Danger • Scam Trap",
    descId:
      "Contoh pool berbahaya: pembuatnya punya akses untuk menyedot 100% uang saat kamu swap dan mengunci penarikan modal.",
    descEn:
      "Dangerous pool: the creator turned on permissions that can take 100% of your swap input and block withdrawals.",
    tone: "danger" as const,
  },
];

export default function Pulse4663Page() {
  const [darkMode, setDarkMode] = useState(false);
  const [lang, setLang] = useState<"id" | "en">("en");
  const [activeView, setActiveView] = useState<"checker" | "developer">(
    "checker"
  );

  // Inputs
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    "live-hookdeploy-token"
  );
  const [targetAddressInput, setTargetAddressInput] = useState<string>(
    "0x0B43C68bC0837E5307a3D3C32fe88Ee601D1D171"
  );
  const [hookAddressInput, setHookAddressInput] = useState<string>(
    "0x0000000000000000000000000000000000000000"
  );
  const [showCustomPoolInput, setShowCustomPoolInput] =
    useState<boolean>(false);
  const [showTechnicalBits, setShowTechnicalBits] = useState<boolean>(false);

  // Policy state
  const [maxAllowedRiskScore] = useState<number>(35);
  const [blockDeltaMutationHooks] = useState<boolean>(true);
  const [blockLpLockHooks] = useState<boolean>(true);

  // Result state
  const [loading, setLoading] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanApiResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Interactive Live Agent state
  const [simEthAmount, setSimEthAmount] = useState<string>("1.0");
  const [agentInput, setAgentInput] = useState<string>("");
  const [agentLoading, setAgentLoading] = useState<boolean>(false);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);

  // Developer salt calculator state
  const [selectedBitsMask, setSelectedBitsMask] = useState<number>(0x00c0);
  const [deployerInput] = useState<string>(
    "0x9423Be20379148fEC92499191282fFfe6B8D9356"
  );
  const [minedData, setMinedData] = useState<{
    targetMaskHex: string;
    targetMaskBinary: string;
    minedSaltHex: string;
    synthesizedHookAddress: string;
    iterations: number;
  } | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [darkMode]);

  const askLiveAgent = useCallback(
    async (
      questionText: string,
      overrideTarget?: string,
      overrideHook?: string
    ) => {
      if (!questionText.trim()) return;
      setAgentLoading(true);
      setAgentMessages((prev) => [
        ...prev,
        { role: "user", text: questionText },
      ]);

      try {
        const res = await fetch("/api/agent-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: questionText,
            lang,
            currentTargetAddress: overrideTarget ?? targetAddressInput,
            currentHookAddress: overrideHook ?? hookAddressInput,
            ethAmount: simEthAmount,
          }),
        });
        const data = await res.json();
        if (data.reply) {
          setAgentMessages((prev) => [
            ...prev,
            {
              role: "agent",
              text: data.reply,
              blockNumber: data.liveBlockNumber,
              latencyMs: data.rpcLatencyMs,
            },
          ]);
        }
      } catch {
        setAgentMessages((prev) => [
          ...prev,
          {
            role: "agent",
            text:
              lang === "id"
                ? "Maaf, terjadi gangguan saat menghubungi node Robinhood Chain."
                : "Failed to reach Robinhood Chain RPC node.",
          },
        ]);
      } finally {
        setAgentLoading(false);
      }
    },
    [lang, targetAddressInput, hookAddressInput, simEthAmount]
  );

  const runPulseScan = useCallback(
    async (overridePreset?: {
      id: string;
      targetAddress: string;
      hookAddress: string;
    }) => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const tAddr = overridePreset?.targetAddress ?? targetAddressInput;
        const hAddr = overridePreset?.hookAddress ?? hookAddressInput;

        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presetId: overridePreset?.id ?? selectedPresetId,
            targetAddress: tAddr,
            hookAddress: hAddr,
            policy: {
              maxAllowedRiskScore,
              blockDeltaMutationHooks,
              blockLpLockHooks,
            },
          }),
        });
        const data: ScanApiResponse & { error?: string } = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Gagal memeriksa alamat.");
        }
        setScanResult(data);

        // Automatically seed the Live Agent with an initial live inspection report
        const initialAgentNote =
          lang === "id"
            ? `Saya baru saja memeriksa kontrak \`${data.onChainData.targetAddress.slice(0, 10)}...${data.onChainData.targetAddress.slice(-6)}\` secara live di **Robinhood Chain Blok #${data.onChainData.blockNumber.toLocaleString()}** (${data.onChainData.rpcLatencyMs}ms).\n\n${
                data.onChainData.tokenTelemetry.isErc20
                  ? `• Token terdeteksi: **${data.onChainData.tokenTelemetry.name} ($${data.onChainData.tokenTelemetry.symbol})** — Total Suplai: **${data.onChainData.tokenTelemetry.totalSupplyFormatted}**, Sudah di-burn: **${data.onChainData.tokenTelemetry.burnedSupplyFormatted} (${data.onChainData.tokenTelemetry.burnedPercentage})**.\n`
                  : `• Ukuran Bytecode Kontrak: **${data.onChainData.bytecodeAnalysis.bytecodeSizeBytes.toLocaleString()} bytes**.\n`
              }• Status Keamanan Pool: **${data.securityVerdict.classification}** (Skor Risiko: ${data.securityVerdict.riskScore}/100).\n\nSilakan klik tombol simulasi di bawah atau tanyakan apa saja tentang token/pool ini!`
            : `I just inspected \`${data.onChainData.targetAddress.slice(0, 10)}...${data.onChainData.targetAddress.slice(-6)}\` live at **Robinhood Chain Block #${data.onChainData.blockNumber.toLocaleString()}** (${data.onChainData.rpcLatencyMs}ms).\n\n${
                data.onChainData.tokenTelemetry.isErc20
                  ? `• Live Token: **${data.onChainData.tokenTelemetry.name} ($${data.onChainData.tokenTelemetry.symbol})** — Total Supply: **${data.onChainData.tokenTelemetry.totalSupplyFormatted}**, Burned: **${data.onChainData.tokenTelemetry.burnedSupplyFormatted} (${data.onChainData.tokenTelemetry.burnedPercentage})**.\n`
                  : `• Deployed Bytecode: **${data.onChainData.bytecodeAnalysis.bytecodeSizeBytes.toLocaleString()} bytes**.\n`
              }• Pool Verdict: **${data.securityVerdict.classification}** (Risk Score: ${data.securityVerdict.riskScore}/100).\n\nClick a simulation button below or ask me anything about this contract!`;

        setAgentMessages([
          {
            role: "agent",
            text: initialAgentNote,
            blockNumber: data.onChainData.blockNumber,
            latencyMs: data.onChainData.rpcLatencyMs,
          },
        ]);
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "Gagal memeriksa kontrak."
        );
      } finally {
        setLoading(false);
      }
    },
    [
      selectedPresetId,
      targetAddressInput,
      hookAddressInput,
      maxAllowedRiskScore,
      blockDeltaMutationHooks,
      blockLpLockHooks,
      lang,
    ]
  );

  const runSaltMiner = useCallback(
    async (maskValue: number, deployer: string) => {
      try {
        const res = await fetch("/api/mine-salt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deployerAddress: deployer,
            targetMask: maskValue,
          }),
        });
        const data = await res.json();
        if (data.mined) {
          setMinedData(data.mined);
        }
      } catch {
        // ignore
      }
    },
    []
  );

  useEffect(() => {
    const initial =
      PULSE_4663_PRESETS.find((p) => p.id === "live-hookdeploy-token") ??
      PULSE_4663_PRESETS[0];
    runPulseScan({
      id: initial.id,
      targetAddress: initial.targetAddress,
      hookAddress: initial.hookAddress,
    });
    runSaltMiner(0x00c0, "0x9423Be20379148fEC92499191282fFfe6B8D9356");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectFriendlyPreset = (id: string) => {
    const preset = PULSE_4663_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setTargetAddressInput(preset.targetAddress);
    setHookAddressInput(preset.hookAddress);
    runPulseScan({
      id: preset.id,
      targetAddress: preset.targetAddress,
      hookAddress: preset.hookAddress,
    });
  };

  const toggleSynthesizerBit = (maskValue: number) => {
    const nextMask = selectedBitsMask ^ maskValue;
    setSelectedBitsMask(nextMask);
    runSaltMiner(nextMask, deployerInput);
  };

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 1800);
  };

  const verdict = scanResult?.securityVerdict;
  const bitmask = scanResult?.bitmaskReport;
  const onChain = scanResult?.onChainData;

  const getHumanHeadline = () => {
    if (!verdict || !bitmask) return "";
    if (verdict.classification === "CRITICAL") {
      return lang === "id"
        ? "Bahaya: Jangan Beli atau Masuk ke Pool Ini"
        : "Danger: Do Not Trade or Add Liquidity to This Pool";
    }
    if (verdict.classification === "WARNING") {
      return lang === "id"
        ? "Hati-hati: Pool Ini Bisa Memotong Pajak Tambahan"
        : "Caution: This Pool Can Deduct Custom Swap Taxes";
    }
    if (onChain?.tokenTelemetry.isErc20) {
      return lang === "id"
        ? `Aman: Token $${onChain.tokenTelemetry.symbol} Terverifikasi di Robinhood Chain`
        : `Safe: $${onChain.tokenTelemetry.symbol} Token Verified on Robinhood Chain`;
    }
    return lang === "id"
      ? "Aman: Tidak Ditemukan Jebakan Penyedot Saldo"
      : "Safe: No Hidden Wallet Drainers or Locks Detected";
  };

  const getHumanExplanation = () => {
    if (!verdict || !bitmask) return "";
    if (verdict.classification === "CRITICAL") {
      return lang === "id"
        ? "Pembuat pool ini mengaktifkan izin rahasia yang memungkinkannya mengambil hingga 100% uang yang kamu masukkan saat swap, serta mengunci penarikan modal (LP). Jika kamu bertransaksi di sini, danamu berisiko hilang."
        : "The creator of this pool enabled permissions that allow taking up to 100% of your input tokens during a swap and locking liquidity withdrawals. Interacting with this pool puts your funds at immediate risk.";
    }
    if (verdict.classification === "WARNING") {
      return lang === "id"
        ? "Pool ini tidak menyita modal awalmu, tetapi memiliki aturan pemotongan hasil swap (pajak output). Pastikan kamu mengecek besaran pajaknya sebelum membeli dalam jumlah besar."
        : "This pool cannot seize your initial input, but it enables custom output fee extraction on swaps. Verify the tax rate before trading size.";
    }
    if (onChain?.tokenTelemetry.isErc20) {
      return lang === "id"
        ? `Kontrak token ${onChain.tokenTelemetry.name} ($${onChain.tokenTelemetry.symbol}) aktif di Robinhood Chain tanpa fungsi penghancur kontrak, dan sebanyak ${onChain.tokenTelemetry.burnedPercentage} dari total suplainya sudah dibakar permanen.`
        : `The ${onChain.tokenTelemetry.name} ($${onChain.tokenTelemetry.symbol}) contract is live on Robinhood Chain with clean bytecode, and ${onChain.tokenTelemetry.burnedPercentage} of its total supply has been permanently burned.`;
    }
    return lang === "id"
      ? "Pool ini hanya menggunakan pengaturan standar (seperti penyesuaian biaya transaksi wajar) dan tidak memiliki akses untuk menyedot saldo pembeli maupun menahan penarikan dana."
      : "This pool only uses standard lifecycle callbacks (such as dynamic fee adjustments) and has zero permission to confiscate swap balances or block withdrawals.";
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#141413] dark:bg-[#0C0E0D] dark:text-[#EDEDEB]">
      {/* Simple, Clean Navigation Header */}
      <header className="border-b border-neutral-200/80 dark:border-neutral-800/80 bg-[#FAF9F6]/90 dark:bg-[#0C0E0D]/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.svg"
              alt="Pulse4663"
              className="w-9 h-9 rounded-none border border-neutral-900 dark:border-neutral-700 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-tight text-base">
                  Pulse4663
                </span>
                <span className="text-xs px-2 py-0.5 bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                  Robinhood Chain
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onChain && (
              <button
                onClick={() => runPulseScan()}
                title="Click to fetch the latest block from Robinhood Chain"
                className="hidden md:inline-flex items-center gap-2 px-2.5 py-1.5 text-xs border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <span className="w-2 h-2 bg-emerald-500" />
                <span className="font-mono">
                  Block #{onChain.blockNumber.toLocaleString()}
                </span>
                <RefreshCw
                  className={`w-3 h-3 text-neutral-500 ${
                    loading ? "animate-spin" : ""
                  }`}
                />
              </button>
            )}

            {/* Mode Switcher */}
            <div className="hidden sm:flex items-center border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-0.5 text-xs">
              <button
                onClick={() => setActiveView("checker")}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  activeView === "checker"
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                {lang === "id" ? "Cek Keamanan Token" : "Safety Checker"}
              </button>
              <button
                onClick={() => setActiveView("developer")}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  activeView === "developer"
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                {lang === "id" ? "Mode Developer" : "Developer Tools"}
              </button>
            </div>

            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === "id" ? "en" : "id")}
              className="px-2.5 py-1.5 text-xs font-medium border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {lang === "id" ? "🇮🇩 ID" : "🇬🇧 EN"}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              aria-label="Toggle theme"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-neutral-700" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 space-y-10">
        {activeView === "checker" ? (
          <>
            {/* Human-Friendly Hero Section */}
            <section className="space-y-6">
              <div className="max-w-2xl space-y-3">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {lang === "id"
                    ? "Detektor Keamanan Token & Pool untuk Robinhood Chain"
                    : "Token & Liquidity Pool Safety Checker for Robinhood Chain"}
                </p>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900 dark:text-white leading-[1.15]">
                  {lang === "id"
                    ? "Cek dulu apakah token atau pool aman sebelum kamu beli."
                    : "Check if a token or pool is safe before you buy."}
                </h1>
                <p className="text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {lang === "id"
                    ? "Banyak pool baru di Robinhood Chain memasang aturan tersembunyi yang bisa menahan penjualan (honeypot) atau memotong pajak hingga 100%. Tempel alamat tokennya di bawah ini—Agent kami akan membaca langsung kontraknya di blockchain dan mensimulasikan keamanannya."
                    : "New pools on Robinhood Chain can hide rules that block selling (honeypots) or take 100% swap taxes. Paste any token or pool address below—our live Agent inspects the blockchain contract and simulates your trade."}
                </p>
              </div>
            </section>

            {/* Clean Search Box + Friendly Preset Cards */}
            <section className="space-y-5">
              <div className="bg-white dark:bg-[#131615] border border-neutral-300 dark:border-neutral-800 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
                      {lang === "id"
                        ? "Alamat Kontrak Token di Robinhood Chain"
                        : "Token or Contract Address on Robinhood Chain"}
                    </label>
                    <input
                      type="text"
                      value={targetAddressInput}
                      onChange={(e) => setTargetAddressInput(e.target.value)}
                      placeholder="0x0B43C68bC0837E5307a3D3C32fe88Ee601D1D171"
                      className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#FAF9F6] dark:bg-[#0C0E0D] border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:border-neutral-900 dark:focus:border-white"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => runPulseScan()}
                      disabled={loading}
                      className="w-full sm:w-auto px-6 py-2.5 text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50"
                    >
                      {loading
                        ? lang === "id"
                          ? "Memeriksa..."
                          : "Checking..."
                        : lang === "id"
                        ? "Cek Keamanan"
                        : "Check Safety"}
                    </button>
                  </div>
                </div>

                {/* Optional Advanced Pool Rule Address */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowCustomPoolInput(!showCustomPoolInput)}
                    className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                  >
                    {showCustomPoolInput ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {lang === "id"
                        ? "Opsi lanjutan: Punya alamat aturan pool (Hook) terpisah?"
                        : "Advanced: Have a separate Uniswap v4 pool rule address?"}
                    </span>
                  </button>

                  {showCustomPoolInput && (
                    <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                      <label className="block text-xs text-neutral-500 mb-1">
                        {lang === "id"
                          ? "Alamat Aturan Pool (Uniswap v4 Hook Address)"
                          : "Pool Rule Address (Uniswap v4 Hook Address)"}
                      </label>
                      <input
                        type="text"
                        value={hookAddressInput}
                        onChange={(e) => setHookAddressInput(e.target.value)}
                        placeholder="0x0000000000000000000000000000000000000000"
                        className="w-full px-3 py-2 text-xs font-mono bg-[#FAF9F6] dark:bg-[#0C0E0D] border border-neutral-300 dark:border-neutral-700"
                      />
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {errorMsg}
                  </p>
                )}
              </div>

              {/* 4 Friendly Example Buttons */}
              <div className="space-y-2">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {lang === "id"
                    ? "Klik salah satu contoh di bawah untuk melihat bagaimana Agent memeriksa token & pool secara langsung:"
                    : "Click any example below to watch the live Agent inspect the contract on Robinhood Chain:"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FRIENDLY_PRESETS.map((item) => {
                    const active = selectedPresetId === item.id;
                    const dotColor =
                      item.tone === "safe"
                        ? "bg-emerald-600"
                        : item.tone === "warn"
                        ? "bg-amber-500"
                        : "bg-red-600";

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectFriendlyPreset(item.id)}
                        className={`text-left p-4 border transition-colors ${
                          active
                            ? "border-neutral-900 dark:border-white bg-white dark:bg-[#161A18]"
                            : "border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-[#131615]/60 hover:border-neutral-400 dark:hover:border-neutral-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium text-sm text-neutral-900 dark:text-white">
                            {lang === "id" ? item.labelId : item.labelEn}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300 shrink-0">
                            <span className={`w-2 h-2 ${dotColor}`} />
                            {lang === "id" ? item.tagId : item.tagEn}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                          {lang === "id" ? item.descId : item.descEn}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* MAIN SAFETY REPORT + LIVE AGENT PROOF */}
            {scanResult && verdict && bitmask && onChain && (
              <section className="bg-white dark:bg-[#131615] border border-neutral-300 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
                {/* 1. Big Clear Verdict Header */}
                <div className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                    <div className="space-y-2.5 max-w-2xl">
                      <div className="inline-flex items-center gap-2 text-xs font-medium">
                        {verdict.classification === "SAFE" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {lang === "id"
                              ? "Hasil Pemeriksaan: AMAN"
                              : "Safety Result: SAFE"}
                          </span>
                        )}
                        {verdict.classification === "WARNING" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {lang === "id"
                              ? "Hasil Pemeriksaan: WASPADA PAJAK"
                              : "Safety Result: CAUTION"}
                          </span>
                        )}
                        {verdict.classification === "CRITICAL" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800">
                            <XCircle className="w-3.5 h-3.5" />
                            {lang === "id"
                              ? "Hasil Pemeriksaan: BAHAYA (JANGAN BELI)"
                              : "Safety Result: DANGER (DO NOT BUY)"}
                          </span>
                        )}
                      </div>

                      <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white">
                        {getHumanHeadline()}
                      </h2>

                      <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                        {getHumanExplanation()}
                      </p>
                    </div>

                    {/* Clean Safety Score Box */}
                    <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-4 sm:pt-0 border-neutral-200 dark:border-neutral-800">
                      <div className="text-xs text-neutral-500">
                        {lang === "id" ? "Tingkat Risiko" : "Risk Score"}
                      </div>
                      <div
                        className={`text-3xl font-semibold font-mono mt-0.5 ${
                          verdict.classification === "SAFE"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : verdict.classification === "WARNING"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {verdict.riskScore}
                        <span className="text-base font-normal text-neutral-400">
                          /100
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        {lang === "id"
                          ? "(Makin kecil makin aman)"
                          : "(Lower is safer)"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. LIVE ON-CHAIN AGENT TRACE (Proving the tech really works against Robinhood Chain RPC) */}
                <div className="p-6 sm:p-8 bg-[#FAF9F6] dark:bg-[#0F1211] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-600" />
                        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                          {lang === "id"
                            ? "Bukti Kerja Agent Secara Real-Time di Robinhood Chain"
                            : "Live Agent Blockchain Inspection Log (Robinhood Chain)"}
                        </h3>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {lang === "id"
                          ? `Data ini ditarik langsung detik ini dari node resmi ${ROBINHOOD_CHAIN_CONFIG.rpcUrl} (Waktu respons: ${onChain.rpcLatencyMs} ms).`
                          : `Fetched live right now from ${ROBINHOOD_CHAIN_CONFIG.rpcUrl} (${onChain.rpcLatencyMs} ms latency).`}
                      </p>
                    </div>

                    <button
                      onClick={() => runPulseScan()}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 shrink-0 self-start sm:self-auto"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          loading ? "animate-spin" : ""
                        }`}
                      />
                      <span>
                        {lang === "id"
                          ? "Cek Ulang Blok Terbaru"
                          : "Re-fetch Latest Block"}
                      </span>
                    </button>
                  </div>

                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#131615]">
                    {(onChain.agentTrace ?? []).map((step) => (
                      <div
                        key={step.stepNumber}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-medium text-neutral-900 dark:text-white">
                            {step.stepNumber}.{" "}
                            {lang === "id" ? step.actionId : step.actionEn}
                          </div>
                          <div className="font-mono text-[11px] text-neutral-500">
                            RPC Call: {step.rpcMethod} → {step.rawProof}
                          </div>
                        </div>
                        <span className="font-mono text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 shrink-0 self-start sm:self-center">
                          LIVE VERIFIED
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. INTERACTIVE AGENT & SWAP SIMULATOR ("Tanya Agent & Simulasikan Beli") */}
                <div className="p-6 sm:p-8 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                        {lang === "id"
                          ? "Interaksi Langsung dengan Agent Pemeriksa"
                          : "Ask the Live Inspector Agent & Simulate a Trade"}
                      </h3>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {lang === "id"
                          ? "Coba simulasikan pembelian dengan ETH atau tanyakan apa saja kepada Agent (kamu bahkan bisa menempel alamat 0x... lain di kolom chat)."
                          : "Simulate buying with ETH or ask the Agent anything (you can even paste another 0x... contract address directly in the chat)."}
                      </p>
                    </div>

                    {/* Quick ETH Dry-Run Simulator Control */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center border border-neutral-300 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#0C0E0D] px-2.5 py-1.5 text-xs">
                        <input
                          type="number"
                          step="0.1"
                          min="0.01"
                          value={simEthAmount}
                          onChange={(e) => setSimEthAmount(e.target.value)}
                          className="w-14 bg-transparent font-mono font-medium focus:outline-none"
                        />
                        <span className="font-mono text-neutral-500">ETH</span>
                      </div>
                      <button
                        onClick={() =>
                          askLiveAgent(
                            lang === "id"
                              ? `Coba simulasikan kalau saya beli ${simEthAmount} ETH di sini, apa yang terjadi?`
                              : `Simulate buying ${simEthAmount} ETH in this pool—what happens?`
                          )
                        }
                        disabled={agentLoading}
                        className="px-3.5 py-1.5 text-xs font-medium bg-emerald-700 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                      >
                        {lang === "id"
                          ? `Simulasikan Beli ${simEthAmount} ETH`
                          : `Simulate ${simEthAmount} ETH Buy`}
                      </button>
                    </div>
                  </div>

                  {/* Quick Question Chips */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        askLiveAgent(
                          lang === "id"
                            ? "Siapa pemilik (owner) kontrak ini dan berapa token yang sudah di-burn?"
                            : "Who is the owner of this contract and how many tokens are burned?"
                        )
                      }
                      className="text-xs px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 bg-[#FAF9F6] dark:bg-[#0C0E0D]"
                    >
                      {lang === "id"
                        ? "🔍 Cek siapa Owner & jumlah Burn"
                        : "🔍 Check Owner & Burned Supply"}
                    </button>
                    <button
                      onClick={() =>
                        askLiveAgent(
                          lang === "id"
                            ? "Tunjukkan bukti kalau kamu beneran baca live dari blockchain Robinhood Chain"
                            : "Show proof that you are reading live from Robinhood Chain right now"
                        )
                      }
                      className="text-xs px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 bg-[#FAF9F6] dark:bg-[#0C0E0D]"
                    >
                      {lang === "id"
                        ? "⛓️ Tunjukkan bukti blok live Robinhood Chain"
                        : "⛓️ Show live Robinhood Chain block proof"}
                    </button>
                    <button
                      onClick={() =>
                        askLiveAgent(
                          lang === "id"
                            ? "Coba cek kontrak PoolManager 0x8366a39CC670B4001A1121B8F6A443A643e40951"
                            : "Inspect PoolManager contract 0x8366a39CC670B4001A1121B8F6A443A643e40951"
                        )
                      }
                      className="text-xs px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 bg-[#FAF9F6] dark:bg-[#0C0E0D]"
                    >
                      {lang === "id"
                        ? "⚙️ Suruh Agent cek kontrak PoolManager"
                        : "⚙️ Ask Agent to inspect PoolManager"}
                    </button>
                  </div>

                  {/* Agent Conversation Log */}
                  <div className="border border-neutral-200 dark:border-neutral-800 bg-[#FAF9F6] dark:bg-[#0C0E0D] p-4 space-y-3 max-h-80 overflow-y-auto">
                    {agentMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`p-3.5 text-xs leading-relaxed whitespace-pre-line ${
                          msg.role === "agent"
                            ? "bg-white dark:bg-[#141816] border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200"
                            : "bg-neutral-900 text-white dark:bg-neutral-800 ml-8"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1 text-[11px] text-neutral-400">
                          <span className="font-semibold text-neutral-900 dark:text-white">
                            {msg.role === "agent"
                              ? "Pulse4663 Live On-Chain Agent"
                              : lang === "id"
                              ? "Kamu"
                              : "You"}
                          </span>
                          {msg.blockNumber && (
                            <span className="font-mono">
                              Robinhood Block #{msg.blockNumber.toLocaleString()}{" "}
                              ({msg.latencyMs}ms)
                            </span>
                          )}
                        </div>
                        <div>{msg.text}</div>
                      </div>
                    ))}
                    {agentLoading && (
                      <div className="p-3 text-xs text-neutral-500 font-mono">
                        {lang === "id"
                          ? "Agent sedang memanggil node RPC Robinhood Chain (4663)..."
                          : "Agent is querying Robinhood Chain RPC (4663)..."}
                      </div>
                    )}
                  </div>

                  {/* Chat Input */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!agentInput.trim()) return;
                      const q = agentInput;
                      setAgentInput("");
                      askLiveAgent(q);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={agentInput}
                      onChange={(e) => setAgentInput(e.target.value)}
                      placeholder={
                        lang === "id"
                          ? "Tanya Agent (misal: 'Kalau beli 2 ETH aman gak?' atau tempel alamat 0x...)"
                          : "Ask the Agent (e.g., 'Is buying 2 ETH safe?' or paste any 0x... address)"
                      }
                      className="flex-1 px-3.5 py-2 text-xs bg-[#FAF9F6] dark:bg-[#0C0E0D] border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:border-neutral-900 dark:focus:border-white"
                    />
                    <button
                      type="submit"
                      disabled={agentLoading}
                      className="px-4 py-2 text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <span>{lang === "id" ? "Tanya Agent" : "Ask Agent"}</span>
                      <Send className="w-3 h-3" />
                    </button>
                  </form>
                </div>

                {/* 4. Live Token Info (When checking a token like $HOOKDEPLOY) */}
                {onChain.tokenTelemetry.isErc20 && (
                  <div className="p-6 sm:p-8 bg-neutral-50/60 dark:bg-neutral-900/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                        {lang === "id"
                          ? "Informasi Token di Robinhood Chain"
                          : "Live Token Information on Robinhood Chain"}
                      </h3>
                      <a
                        href={`${ROBINHOOD_CHAIN_CONFIG.explorerUrl}/address/${onChain.targetAddress}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400 hover:underline"
                      >
                        <span>
                          {lang === "id"
                            ? "Lihat di Explorer Robinhood Chain"
                            : "View on Robinhood Explorer"}
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-neutral-500">
                          {lang === "id"
                            ? "Nama & Simbol Token"
                            : "Token Name & Symbol"}
                        </div>
                        <div className="text-base font-semibold text-neutral-900 dark:text-white mt-0.5">
                          {onChain.tokenTelemetry.name} ($
                          {onChain.tokenTelemetry.symbol})
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-neutral-500">
                          {lang === "id"
                            ? "Total Suplai Beredar"
                            : "Total Supply"}
                        </div>
                        <div className="text-base font-semibold font-mono text-neutral-900 dark:text-white mt-0.5">
                          {onChain.tokenTelemetry.totalSupplyFormatted}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-neutral-500">
                          {lang === "id"
                            ? "Token Sudah Dibakar (Burned)"
                            : "Burned in Dead Wallet"}
                        </div>
                        <div className="text-base font-semibold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                          {onChain.tokenTelemetry.burnedSupplyFormatted} (
                          {onChain.tokenTelemetry.burnedPercentage})
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Plain-English 4-Point Safety Checklist */}
                <div className="p-6 sm:p-8 space-y-5">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {lang === "id"
                      ? "4 Poin Pemeriksaan Keamanan Utama"
                      : "4 Core Safety Checks"}
                  </h3>

                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border-t border-b border-neutral-200 dark:border-neutral-800">
                    <div className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium text-neutral-900 dark:text-white">
                          {lang === "id"
                            ? "1. Apakah uangmu aman saat beli / jual (Swap)?"
                            : "1. Are your funds safe during a buy or sell swap?"}
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {bitmask.permissions.find((p) => p.bitIndex === 3)
                            ?.enabled
                            ? lang === "id"
                              ? "BAHAYA: Pool ini mengaktifkan fitur yang bisa menyita 100% uang pembeli tanpa memberikan koin."
                              : "DANGER: This pool can take 100% of your swap input and return zero tokens."
                            : lang === "id"
                            ? "Aman. Pool ini tidak bisa menyita modal saat kamu melakukan swap."
                            : "Safe. This pool cannot confiscate your input tokens when you swap."}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium px-2.5 py-1 shrink-0 ${
                          bitmask.permissions.find((p) => p.bitIndex === 3)
                            ?.enabled
                            ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        }`}
                      >
                        {bitmask.permissions.find((p) => p.bitIndex === 3)
                          ?.enabled
                          ? lang === "id"
                            ? "Bahaya Penyedot"
                            : "Drainer Risk"
                          : lang === "id"
                          ? "Lolos • Aman"
                          : "Passed • Safe"}
                      </span>
                    </div>

                    <div className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium text-neutral-900 dark:text-white">
                          {lang === "id"
                            ? "2. Apakah penarikan dana (Withdraw LP) bebas dari kunci paksa?"
                            : "2. Can liquidity providers withdraw their funds freely?"}
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {bitmask.canLockLiquidity ||
                          bitmask.permissions.find((p) => p.bitIndex === 0)
                            ?.enabled
                            ? lang === "id"
                              ? "BAHAYA: Pembuat pool bisa menahan tombol withdraw atau memotong modal saat ditarik."
                              : "DANGER: The pool creator can block withdrawals or seize tokens upon exit."
                            : lang === "id"
                            ? "Aman. Tidak ada aturan yang mengunci atau menyita penarikan dana."
                            : "Safe. Withdrawals are not intercepted or locked by the pool."}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium px-2.5 py-1 shrink-0 ${
                          bitmask.canLockLiquidity ||
                          bitmask.permissions.find((p) => p.bitIndex === 0)
                            ?.enabled
                            ? "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        }`}
                      >
                        {bitmask.canLockLiquidity ||
                        bitmask.permissions.find((p) => p.bitIndex === 0)
                          ?.enabled
                          ? lang === "id"
                            ? "Bisa Dikunci"
                            : "Lock Risk"
                          : lang === "id"
                          ? "Lolos • Aman"
                          : "Passed • Safe"}
                      </span>
                    </div>

                    <div className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium text-neutral-900 dark:text-white">
                          {lang === "id"
                            ? "3. Apakah ada potongan pajak tambahan dari hasil pembelian?"
                            : "3. Is there an extra tax deducted from your swap output?"}
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {bitmask.permissions.find((p) => p.bitIndex === 2)
                            ?.enabled
                            ? lang === "id"
                              ? "WASPADA: Pool ini bisa memotong persentase tertentu dari koin yang kamu terima saat swap."
                              : "CAUTION: This pool can deduct a custom tax from the tokens you receive."
                            : lang === "id"
                            ? "Aman. Koin hasil swap yang kamu terima tidak dipotong pajak tersembunyi."
                            : "Safe. No custom output tax is deducted from the coins you receive."}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium px-2.5 py-1 shrink-0 ${
                          bitmask.permissions.find((p) => p.bitIndex === 2)
                            ?.enabled
                            ? "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        }`}
                      >
                        {bitmask.permissions.find((p) => p.bitIndex === 2)
                          ?.enabled
                          ? lang === "id"
                            ? "Ada Pajak Output"
                            : "Custom Tax"
                          : lang === "id"
                          ? "Tanpa Pajak Ekstra"
                          : "No Extra Tax"}
                      </span>
                    </div>

                    <div className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium text-neutral-900 dark:text-white">
                          {lang === "id"
                            ? "4. Apakah kode kontraknya asli & bersih di Robinhood Chain?"
                            : "4. Is the smart contract code verified live on Robinhood Chain?"}
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {onChain.bytecodeAnalysis.hasSelfDestructOpcode
                            ? lang === "id"
                              ? "BAHAYA: Kontrak memiliki instruksi penghancur otomatis (SELFDESTRUCT)."
                              : "DANGER: Contract contains a SELFDESTRUCT opcode."
                            : lang === "id"
                            ? `Terverifikasi di blok #${onChain.blockNumber.toLocaleString()} (${onChain.bytecodeAnalysis.bytecodeSizeBytes.toLocaleString()} bytes) tanpa kode penghancur kontrak.`
                            : `Verified at block #${onChain.blockNumber.toLocaleString()} (${onChain.bytecodeAnalysis.bytecodeSizeBytes.toLocaleString()} bytes) with no self-destruct instructions.`}
                        </p>
                      </div>
                      <span className="text-xs font-medium px-2.5 py-1 shrink-0 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {lang === "id" ? "Kontrak Aktif" : "Verified Live"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 6. Expandable Technical Details */}
                <div className="p-6 sm:p-8 bg-neutral-50/40 dark:bg-neutral-900/20">
                  <button
                    onClick={() => setShowTechnicalBits(!showTechnicalBits)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div>
                      <div className="text-xs font-medium text-neutral-900 dark:text-white">
                        {lang === "id"
                          ? "Lihat Detail Teknis (14-Bit Uniswap v4 Permissions & Kontrak Solidity)"
                          : "View Technical Details (14-Bit Uniswap v4 Permissions & Solidity Guard)"}
                      </div>
                      <p className="text-xs text-neutral-500">
                        {lang === "id"
                          ? `Kode buntut alamat pool: ${bitmask.bottom14BitsHex} (${bitmask.activePermissionsCount} dari 14 izin aktif)`
                          : `Pool address 14-bit suffix: ${bitmask.bottom14BitsHex} (${bitmask.activePermissionsCount} of 14 permissions active)`}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 inline-flex items-center gap-1">
                      {showTechnicalBits
                        ? lang === "id"
                          ? "Sembunyikan"
                          : "Hide"
                        : lang === "id"
                        ? "Buka Rincian"
                        : "Expand"}
                      {showTechnicalBits ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  </button>

                  {showTechnicalBits && (
                    <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-800 space-y-6">
                      <div className="text-xs font-mono p-3.5 bg-white dark:bg-[#0C0E0D] border border-neutral-200 dark:border-neutral-800">
                        <div className="font-semibold text-neutral-900 dark:text-white mb-1">
                          Pulse4663Guard.sol (On-Chain Enforcement):
                        </div>
                        <p className="text-neutral-600 dark:text-neutral-400">
                          {verdict.guardContractVerdict.solidityCheckSummary}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {bitmask.permissions.map((perm) => (
                          <div
                            key={perm.bitIndex}
                            className={`p-3 border text-xs ${
                              perm.enabled
                                ? perm.riskLevel === "CRITICAL" ||
                                  perm.riskLevel === "HIGH"
                                  ? "border-red-300 dark:border-red-800 bg-red-50/40 dark:bg-red-950/30"
                                  : "border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/30"
                                : "border-neutral-200 dark:border-neutral-800 opacity-60"
                            }`}
                          >
                            <div className="flex items-center justify-between font-mono">
                              <span className="font-medium text-neutral-900 dark:text-white">
                                Bit {perm.bitIndex}: {perm.shortLabel} (
                                {perm.hexMask})
                              </span>
                              <span>{perm.enabled ? "ON" : "OFF"}</span>
                            </div>
                            <p className="text-[11px] text-neutral-500 mt-1">
                              {perm.technicalImpact}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        ) : (
          /* DEVELOPER VIEW */
          <div className="space-y-8">
            <div className="space-y-2">
              <button
                onClick={() => setActiveView("checker")}
                className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white inline-flex items-center gap-1"
              >
                ←{" "}
                {lang === "id"
                  ? "Kembali ke Cek Keamanan Token"
                  : "Back to Token Safety Checker"}
              </button>
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white">
                {lang === "id"
                  ? "Peralatan Developer Uniswap v4 di Robinhood Chain"
                  : "Uniswap v4 Developer Tools on Robinhood Chain"}
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {lang === "id"
                  ? "Gunakan halaman ini jika kamu adalah developer yang sedang membuat kontrak pool Uniswap v4 di Robinhood Chain (Chain ID: 4663)."
                  : "Use these utilities when deploying custom Uniswap v4 pools or routers on Robinhood Chain (Chain ID: 4663)."}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white dark:bg-[#131615] border border-neutral-300 dark:border-neutral-800 p-6 space-y-4">
                <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                  {lang === "id"
                    ? "Kalkulator Alamat Kontrak 14-Bit (CREATE2 Salt)"
                    : "14-Bit Hook Address & CREATE2 Salt Calculator"}
                </h3>
                <p className="text-xs text-neutral-500">
                  {lang === "id"
                    ? "Centang fitur pool yang kamu butuhkan. Kalkulator ini otomatis mencarikan kode Salt agar buntut alamat kontrakmu sesuai dengan aturan Uniswap v4."
                    : "Select the callbacks your pool requires to compute the matching 14-bit address suffix and CREATE2 deployment salt."}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {UNISWAP_V4_PERMISSION_DEFS.map((def) => {
                    const isChecked = (selectedBitsMask & def.maskValue) !== 0;
                    return (
                      <button
                        key={def.bitIndex}
                        onClick={() => toggleSynthesizerBit(def.maskValue)}
                        className={`p-2.5 border text-left text-xs transition-colors ${
                          isChecked
                            ? "border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-800"
                            : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-400"
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono">
                          <span className="font-medium">{def.shortLabel}</span>
                          <span className="text-neutral-500">
                            {def.hexMask}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {minedData && (
                  <div className="p-4 bg-[#FAF9F6] dark:bg-[#0C0E0D] border border-neutral-200 dark:border-neutral-800 space-y-3 text-xs font-mono">
                    <div>
                      <span className="text-neutral-500 block">
                        Target 14-Bit Mask:
                      </span>
                      <span className="font-semibold text-sm">
                        {minedData.targetMaskHex} ({minedData.targetMaskBinary})
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">
                          CREATE2 Salt (bytes32):
                        </span>
                        <button
                          onClick={() =>
                            handleCopy(minedData.minedSaltHex, "salt")
                          }
                          className="inline-flex items-center gap-1 text-neutral-700 dark:text-neutral-300 hover:underline"
                        >
                          {copiedText === "salt" ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="break-all mt-0.5">
                        {minedData.minedSaltHex}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-800">
                      <span className="break-all">
                        {minedData.synthesizedHookAddress}
                      </span>
                      <button
                        onClick={() => {
                          setHookAddressInput(minedData.synthesizedHookAddress);
                          setActiveView("checker");
                          runPulseScan({
                            id: selectedPresetId,
                            targetAddress: targetAddressInput,
                            hookAddress: minedData.synthesizedHookAddress,
                          });
                        }}
                        className="inline-flex items-center gap-1 font-sans font-medium text-emerald-700 dark:text-emerald-400 shrink-0 ml-2"
                      >
                        <span>Test</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 bg-white dark:bg-[#131615] border border-neutral-300 dark:border-neutral-800 p-6 space-y-4">
                <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                  {lang === "id"
                    ? "Daftar Kontrak Resmi Uniswap v4 (Robinhood Chain)"
                    : "Official Uniswap v4 Contracts on Robinhood Chain"}
                </h3>
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
                  {(scanResult?.v4StackStatus.contracts ?? []).map((c) => (
                    <div
                      key={c.address}
                      className="py-3 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-medium text-neutral-900 dark:text-white">
                          {c.name}
                        </div>
                        <div className="text-neutral-500">{c.role}</div>
                        <div className="font-mono text-[11px] text-neutral-400 mt-0.5">
                          {c.address.slice(0, 12)}...{c.address.slice(-8)}
                        </div>
                      </div>
                      <a
                        href={`${ROBINHOOD_CHAIN_CONFIG.explorerUrl}/address/${c.address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-neutral-200/80 dark:border-neutral-800/80 py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div>
            Pulse4663 —{" "}
            {lang === "id"
              ? "Pemeriksa Keamanan Token & Pool di Robinhood Chain (4663)"
              : "Token & Pool Safety Checker for Robinhood Chain (4663)"}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() =>
                setActiveView(
                  activeView === "checker" ? "developer" : "checker"
                )
              }
              className="hover:underline"
            >
              {activeView === "checker"
                ? lang === "id"
                  ? "Buka Mode Developer"
                  : "Open Developer Mode"
                : lang === "id"
                ? "Kembali ke Mode Standar"
                : "Back to Standard View"}
            </button>
            <span>•</span>
            <a
              href="https://robinhoodchain.blockscout.com"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              Robinhood Chain Explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
