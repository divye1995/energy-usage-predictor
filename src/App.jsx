import React, { useState, useEffect, useRef, useCallback } from "react";
import Chart from "chart.js/auto";
import ReactMarkdown from "react-markdown";

// Utility to wrap long labels for Chart.js
const wrapLabel = (label) => {
  if (typeof label !== "string") return label;
  if (label.length <= 16) return label;

  const words = label.split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    if ((currentLine + word).length > 16 && currentLine.length > 0) {
      lines.push(currentLine.trim());
      currentLine = word + " ";
    } else {
      currentLine += word + " ";
    }
  });
  lines.push(currentLine.trim());
  return lines;
};

// Tooltip callback for Chart.js
const tooltipTitleCallback = (tooltipItems) => {
  const item = tooltipItems[0];
  let label = item.chart.data.labels[item.dataIndex];
  if (Array.isArray(label)) {
    return label.join(" ");
  }
  return label;
};

// Modal Component
const Modal = ({
  show,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
}) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
        <h3 className="text-xl font-semibold mb-4 text-gray-800">{title}</h3>
        <p className="mb-6 text-gray-700">{message}</p>
        <div className="flex justify-end space-x-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition duration-150"
            >
              {cancelText}
            </button>
          )}
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-150"
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sessionName, setSessionName] = useState("");
  const [monthlyUsageProjectionBasis, setMonthlyUsageProjectionBasis] =
    useState("200, 180, 220, 300, 350, 400, 420, 380, 300, 250, 200, 180");
  const [peakPercentage, setPeakPercentage] = useState(70); // Default peak usage percentage
  const [nMonths, setNMonths] = useState(12);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [isFixedCharge, setIsFixedCharge] = useState(false);
  const [fixedRates, setFixedRates] = useState({
    peakUnitRate: 25.0,
    offPeakUnitRate: 12.0,
    standingCharge: 50.0,
  });
  const [currentTariffBand, setCurrentTariffBand] = useState({
    peakUnitRate: 27.0,
    standingCharge: 55.0,
    offPeakUnitRate: 15.0,
  });
  const [tariffQuarters, setTariffQuarters] = useState([
    {
      name: "Current Month",
      peakUnitRate: 27.0,
      standingCharge: 55.0,
      offPeakUnitRate: 15.0,
    },
    {
      name: "Next Quarter",
      peakUnitRate: 27.5,
      standingCharge: 55.5,
      offPeakUnitRate: 15.5,
    },
    {
      name: "Following Quarter",
      peakUnitRate: 28.0,
      standingCharge: 56.0,
      offPeakUnitRate: 16.0,
    },
  ]);

  const [projectedUsage, setProjectedUsage] = useState([]);
  const [projectedCosts, setProjectedCosts] = useState([]);
  const [totalProjectedCost, setTotalProjectedCost] = useState(0);

  const [savedSessions, setSavedSessions] = useState([]);
  const [selectedSession1, setSelectedSession1] = useState(null);
  const [selectedSession2, setSelectedSession2] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({});

  // LLM related states
  const [llmLoading, setLlmLoading] = useState(false);
  const [usageTips, setUsageTips] = useState("");
  const [comparisonSummary, setComparisonSummary] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Chart.js canvas refs
  const usageCanvasRef = useRef(null);
  const costCanvasRef = useRef(null);
  const compareUsageCanvasRef = useRef(null);
  const compareCostCanvasRef = useRef(null);

  // Helper function to determine if a month is winter (higher consumption/rates)
  const isWinterMonth = (month) => {
    // Winter months: Oct, Nov, Dec, Jan, Feb, Mar (higher consumption)
    return month >= 10 || month <= 3;
  };

  // Function to calculate automatic tariff bands based on current band and seasonal adjustments
  const calculateTariffBands = useCallback(() => {
    const currentIsWinter = isWinterMonth(currentMonth);
    
    // Base increases for tariff progression
    const baseIncrease = {
      peakUnitRate: 0.5, // 0.5p increase per quarter
      standingCharge: 0.5, // 0.5p increase per quarter
      offPeakUnitRate: 0.5, // 0.5p increase per quarter
    };

    // Seasonal adjustments (winter months typically have higher rates)
    const seasonalMultiplier = {
      winter: 1.1, // 10% higher in winter
      summer: 0.95, // 5% lower in summer
    };

    const bands = [];
    
    // First band - current month
    bands.push({
      name: "Current Month",
      ...currentTariffBand,
    });

    // Calculate next two bands with seasonal adjustments
    for (let i = 1; i <= 2; i++) {
      const futureMonth = ((currentMonth - 1 + (i * 3)) % 12) + 1; // +3 months for each quarter
      const isWinter = isWinterMonth(futureMonth);
      const multiplier = isWinter ? seasonalMultiplier.winter : seasonalMultiplier.summer;
      
      const band = {
        name: i === 1 ? "Next Quarter" : "Following Quarter",
        peakUnitRate: Math.round((currentTariffBand.peakUnitRate + (baseIncrease.peakUnitRate * i)) * multiplier * 100) / 100,
        standingCharge: Math.round((currentTariffBand.standingCharge + (baseIncrease.standingCharge * i)) * multiplier * 100) / 100,
        offPeakUnitRate: Math.round((currentTariffBand.offPeakUnitRate + (baseIncrease.offPeakUnitRate * i)) * multiplier * 100) / 100,
      };
      
      bands.push(band);
    }

    setTariffQuarters(bands);
  }, [currentTariffBand, currentMonth]);

  // Update tariff bands when current tariff or month changes
  useEffect(() => {
    calculateTariffBands();
  }, [calculateTariffBands]);

  // Load sessions and API key from local storage on component mount
  useEffect(() => {
    try {
      const storedSessions = localStorage.getItem("energySessions");
      if (storedSessions) {
        setSavedSessions(JSON.parse(storedSessions));
      }
      
      const storedApiKey = localStorage.getItem("geminiApiKey");
      if (storedApiKey) {
        setGeminiApiKey(storedApiKey);
      }
    } catch (err) {
      console.error("Failed to load data from local storage:", err);
      setError("Failed to load saved data from local storage.");
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateProjection = useCallback(() => {
    try {
      const usageBasis = monthlyUsageProjectionBasis
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      if (usageBasis.length === 0) {
        setError("Monthly Usage Projection Basis cannot be empty.");
        setProjectedUsage([]);
        setProjectedCosts([]);
        setTotalProjectedCost(0);
        return;
      }

      const projectedMonths = [];
      const projectedCostsCalc = [];
      let currentTotalCost = 0;

      const offPeakPercentage = 100 - peakPercentage;

      for (let i = 0; i < nMonths; i++) {
        const monthIndex = i % usageBasis.length;
        const totalUsage = usageBasis[monthIndex];

        const peakUsage = totalUsage * (peakPercentage / 100);
        const offPeakUsage = totalUsage * (offPeakPercentage / 100);

        projectedMonths.push(totalUsage); // Store total usage for chart/table

        // Determine which tariff band to use
        let applicableTariff = tariffQuarters[2]; // Default to Q3 if N > 9 months or quarter index out of bounds
        if (i < 3) {
          // Months 0, 1, 2 for Q1 (Jul-Sep)
          applicableTariff = tariffQuarters[0];
        } else if (i < 6) {
          // Months 3, 4, 5 for Q2 (Oct-Dec)
          applicableTariff = tariffQuarters[1];
        } else if (i < 9) {
          // Months 6, 7, 8 for Q3 (Jan-Mar)
          applicableTariff = tariffQuarters[2];
        }

        const daysInMonth = new Date(2025, i + 1, 0).getDate(); // Approximate days in month

        let monthCost;
        if (isFixedCharge) {
          // Fixed rates mode - use fixed unit rates for all months
          const totalUnitCost =
            (peakUsage * fixedRates.peakUnitRate) / 100 +
            (offPeakUsage * fixedRates.offPeakUnitRate) / 100;
          const totalStandingChargeCost =
            (daysInMonth * fixedRates.standingCharge) / 100;

          monthCost = totalUnitCost + totalStandingChargeCost;
        } else {
          // Variable tariff band mode
          const totalUnitCost =
            (peakUsage * applicableTariff.peakUnitRate) / 100 +
            (offPeakUsage * applicableTariff.offPeakUnitRate) / 100;
          const totalStandingChargeCost =
            (daysInMonth * applicableTariff.standingCharge) / 100;

          monthCost = totalUnitCost + totalStandingChargeCost;
        }
        projectedCostsCalc.push(parseFloat(monthCost.toFixed(2)));
        currentTotalCost += monthCost;
      }

      setProjectedUsage(projectedMonths);
      setProjectedCosts(projectedCostsCalc);
      setTotalProjectedCost(currentTotalCost);
      setError(null);
    } catch (err) {
      console.error("Calculation error:", err);
      setError("Error during calculation. Please check your inputs.");
    }
  }, [monthlyUsageProjectionBasis, peakPercentage, nMonths, tariffQuarters, isFixedCharge, fixedRates]);

  // Recalculate projection on input change
  useEffect(() => {
    setUsageTips(""); // Clear tips when inputs change
    setComparisonSummary(""); // Clear summary when inputs change
    calculateProjection();
  }, [calculateProjection]);

  const renderCharts = useCallback(() => {
    if (!projectedUsage.length || !projectedCosts.length) return;

    const monthLabels = Array.from(
      { length: nMonths },
      (_, i) => `Month ${i + 1}`
    );

    // Destroy existing charts if they exist
    if (usageCanvasRef.current && usageCanvasRef.current.chartInstance) {
      usageCanvasRef.current.chartInstance.destroy();
    }
    if (costCanvasRef.current && costCanvasRef.current.chartInstance) {
      costCanvasRef.current.chartInstance.destroy();
    }

    // Render Usage Chart
    const usageCtx = usageCanvasRef.current?.getContext("2d");
    if (usageCtx) {
      usageCanvasRef.current.chartInstance = new Chart(usageCtx, {
        type: "bar",
        data: {
          labels: wrapLabel(monthLabels),
          datasets: [
            {
              label: "Projected Monthly Usage (kWh)",
              data: projectedUsage,
              backgroundColor: "rgba(59, 130, 246, 0.6)", // blue-500
              borderColor: "rgba(59, 130, 246, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top" },
            tooltip: { callbacks: { title: tooltipTitleCallback } },
          },
          scales: {
            x: {
              title: { display: true, text: "Month" },
            },
            y: {
              beginAtZero: true,
              title: { display: true, text: "Usage (kWh)" },
            },
          },
        },
      });
    }

    // Render Cost Chart
    const costCtx = costCanvasRef.current?.getContext("2d");
    if (costCtx) {
      costCanvasRef.current.chartInstance = new Chart(costCtx, {
        type: "line",
        data: {
          labels: wrapLabel(monthLabels),
          datasets: [
            {
              label: "Projected Monthly Cost (£)",
              data: projectedCosts,
              backgroundColor: "rgba(239, 68, 68, 0.6)", // red-500
              borderColor: "rgba(239, 68, 68, 1)",
              borderWidth: 2,
              tension: 0.3,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top" },
            tooltip: { callbacks: { title: tooltipTitleCallback } },
          },
          scales: {
            x: {
              title: { display: true, text: "Month" },
            },
            y: {
              beginAtZero: true,
              title: { display: true, text: "Cost (£)" },
            },
          },
        },
      });
    }
  }, [projectedUsage, projectedCosts, nMonths]);

  useEffect(() => {
    renderCharts();
  }, [renderCharts]);

  const handleSaveSession = () => {
    if (!sessionName.trim()) {
      setModalContent({
        title: "Missing Name",
        message: "Please provide a name for this session to save it.",
        onConfirm: () => setShowModal(false),
      });
      setShowModal(true);
      return;
    }

    setLoading(true);
    try {
      const newSession = {
        id: crypto.randomUUID(), // Generate a unique ID for the session
        name: sessionName,
        monthlyUsageProjectionBasis,
        peakPercentage, // Save the peak percentage
        nMonths,
        currentMonth,
        isFixedCharge,
        fixedRates,
        currentTariffBand,
        tariffQuarters,
        projectedUsage,
        projectedCosts,
        totalProjectedCost: parseFloat(totalProjectedCost.toFixed(2)),
        createdAt: new Date().toISOString(),
      };

      const updatedSessions = [...savedSessions, newSession];
      localStorage.setItem("energySessions", JSON.stringify(updatedSessions));
      setSavedSessions(updatedSessions); // Update state to reflect new session

      setModalContent({
        title: "Session Saved!",
        message: `Session '${sessionName}' has been successfully saved to local storage.`,
        onConfirm: () => setShowModal(false),
      });
      setShowModal(true);
      setSessionName("");
      setError(null);
    } catch (err) {
      console.error("Error saving session to local storage:", err);
      setError("Failed to save session to local storage.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSession = (session) => {
    setSessionName(session.name);
    setMonthlyUsageProjectionBasis(session.monthlyUsageProjectionBasis);
    setPeakPercentage(session.peakPercentage || 70); // Load peak percentage, default if not present
    setCurrentMonth(session.currentMonth || new Date().getMonth() + 1);
    setIsFixedCharge(session.isFixedCharge || false);
    setFixedRates(session.fixedRates || {
      peakUnitRate: 25.0,
      offPeakUnitRate: 12.0,
      standingCharge: 50.0,
    });
    setCurrentTariffBand(session.currentTariffBand || {
      peakUnitRate: 27.0,
      standingCharge: 55.0,
      offPeakUnitRate: 15.0,
    });
    // Ensure that loaded tariffQuarters has the 'standingCharge' property
    const loadedTariffQuarters = session.tariffQuarters.map((q) => ({
      ...q,
      standingCharge: q.standingCharge !== undefined ? q.standingCharge : 0, // Default to 0 if not present
    }));
    setTariffQuarters(loadedTariffQuarters);
    setNMonths(session.nMonths);
    setProjectedUsage(session.projectedUsage || []);
    setProjectedCosts(session.projectedCosts || []);
    setTotalProjectedCost(session.totalProjectedCost || 0);
    setSelectedSession1(null); // Clear compare selections
    setSelectedSession2(null);
    setUsageTips(""); // Clear LLM tips
    setComparisonSummary(""); // Clear LLM summary
  };

  const handleCompareSessions = useCallback(() => {
    if (!selectedSession1 || !selectedSession2) {
      setError("Please select two sessions to compare.");
      return;
    }

    const monthLabels = Array.from(
      { length: Math.max(selectedSession1.nMonths, selectedSession2.nMonths) },
      (_, i) => `Month ${i + 1}`
    );

    // Destroy existing compare charts if they exist
    if (
      compareUsageCanvasRef.current &&
      compareUsageCanvasRef.current.chartInstance
    ) {
      compareUsageCanvasRef.current.chartInstance.destroy();
    }
    if (
      compareCostCanvasRef.current &&
      compareCostCanvasRef.current.chartInstance
    ) {
      compareCostCanvasRef.current.chartInstance.destroy();
    }

    // Render Compare Usage Chart
    const compareUsageCtx = compareUsageCanvasRef.current?.getContext("2d");
    if (compareUsageCtx) {
      compareUsageCanvasRef.current.chartInstance = new Chart(compareUsageCtx, {
        type: "line",
        data: {
          labels: wrapLabel(monthLabels),
          datasets: [
            {
              label: `${selectedSession1.name} Usage (kWh)`,
              data: selectedSession1.projectedUsage,
              borderColor: "rgba(59, 130, 246, 1)", // blue-500
              backgroundColor: "rgba(59, 130, 246, 0.2)",
              fill: false,
              tension: 0.3,
            },
            {
              label: `${selectedSession2.name} Usage (kWh)`,
              data: selectedSession2.projectedUsage,
              borderColor: "rgba(239, 68, 68, 1)", // red-500
              backgroundColor: "rgba(239, 68, 68, 0.2)",
              fill: false,
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top" },
            tooltip: { callbacks: { title: tooltipTitleCallback } },
          },
          scales: {
            x: {
              title: { display: true, text: "Month" },
            },
            y: {
              beginAtZero: true,
              title: { display: true, text: "Usage (kWh)" },
            },
          },
        },
      });
    }

    // Render Compare Cost Chart
    const compareCostCtx = compareCostCanvasRef.current?.getContext("2d");
    if (compareCostCtx) {
      compareCostCanvasRef.current.chartInstance = new Chart(compareCostCtx, {
        type: "line",
        data: {
          labels: wrapLabel(monthLabels),
          datasets: [
            {
              label: `${selectedSession1.name} Cost (£)`,
              data: selectedSession1.projectedCosts,
              borderColor: "rgba(168, 85, 247, 1)", // purple-500
              backgroundColor: "rgba(168, 85, 247, 0.2)",
              fill: false,
              tension: 0.3,
            },
            {
              label: `${selectedSession2.name} Cost (£)`,
              data: selectedSession2.projectedCosts,
              borderColor: "rgba(14, 165, 233, 1)", // sky-500
              backgroundColor: "rgba(14, 165, 233, 0.2)",
              fill: false,
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top" },
            tooltip: { callbacks: { title: tooltipTitleCallback } },
          },
          scales: {
            x: {
              title: { display: true, text: "Month" },
            },
            y: {
              beginAtZero: true,
              title: { display: true, text: "Cost (£)" },
            },
          },
        },
      });
    }
  }, [selectedSession1, selectedSession2]);

  useEffect(() => {
    if (selectedSession1 && selectedSession2) {
      handleCompareSessions();
    }
  }, [selectedSession1, selectedSession2, handleCompareSessions]);

  const handleSaveApiKey = () => {
    if (!geminiApiKey.trim()) {
      setError("Please enter a valid API key.");
      return;
    }
    
    try {
      localStorage.setItem("geminiApiKey", geminiApiKey);
      setShowApiKeyModal(false);
      setError(null);
      setModalContent({
        title: "API Key Saved!",
        message: "Your Gemini API key has been saved securely in your browser. You can now use AI features.",
        onConfirm: () => setShowModal(false),
      });
      setShowModal(true);
    } catch (err) {
      console.error("Failed to save API key:", err);
      setError("Failed to save API key to local storage.");
    }
  };

  const handleRemoveApiKey = () => {
    try {
      localStorage.removeItem("geminiApiKey");
      setGeminiApiKey("");
      setUsageTips("");
      setComparisonSummary("");
      setModalContent({
        title: "API Key Removed",
        message: "Your Gemini API key has been removed. AI features will no longer work until you add a new key.",
        onConfirm: () => setShowModal(false),
      });
      setShowModal(true);
    } catch (err) {
      console.error("Failed to remove API key:", err);
      setError("Failed to remove API key.");
    }
  };

  const checkApiKeyAndExecute = (callback) => {
    if (!geminiApiKey) {
      setShowApiKeyModal(true);
      return;
    }
    callback();
  };

  const getUsageTips = async () => {
    setLlmLoading(true);
    setUsageTips(""); // Clear previous tips
    try {
      const rateInfo = isFixedCharge 
        ? `Fixed Rates: Peak ${fixedRates.peakUnitRate}p/kWh, Off-Peak ${fixedRates.offPeakUnitRate}p/kWh, Standing Charge ${fixedRates.standingCharge}p/day`
        : `Tariff Quarters:
- ${tariffQuarters[0].name}: Peak ${tariffQuarters[0].peakUnitRate}p/kWh, Off-Peak ${tariffQuarters[0].offPeakUnitRate}p/kWh, Standing ${tariffQuarters[0].standingCharge}p/day
- ${tariffQuarters[1].name}: Peak ${tariffQuarters[1].peakUnitRate}p/kWh, Off-Peak ${tariffQuarters[1].offPeakUnitRate}p/kWh, Standing ${tariffQuarters[1].standingCharge}p/day
- ${tariffQuarters[2].name}: Peak ${tariffQuarters[2].peakUnitRate}p/kWh, Off-Peak ${tariffQuarters[2].offPeakUnitRate}p/kWh, Standing ${tariffQuarters[2].standingCharge}p/day`;

      const prompt = `You are an expert energy advisor. Analyze the following projected monthly electricity usage (kWh) and the percentage of usage that falls into peak hours. Provide actionable, concise, and helpful tips for reducing overall cost, specifically highlighting months or periods where shifting usage might be beneficial, and suggest general energy-saving practices.

Projected Monthly Usage (kWh): ${projectedUsage.join(", ")}
Peak Usage Percentage: ${peakPercentage}%
${rateInfo}

Focus on practical advice given the peak/off-peak split and tariff differences. Keep the tips concise, ideally as bullet points or short paragraphs.`;

      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });
      const payload = { contents: chatHistory };
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();

      if (
        result.candidates &&
        result.candidates.length > 0 &&
        result.candidates[0].content &&
        result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0
      ) {
        const text = result.candidates[0].content.parts[0].text;
        setUsageTips(text);
        setError(null);
      } else {
        setError("AI did not return valid usage tips. Please check your API key and try again.");
        console.error("AI response structure unexpected:", result);
      }
    } catch (apiError) {
      console.error("Error calling Gemini API for usage tips:", apiError);
      if (apiError.message.includes('401') || apiError.message.includes('403')) {
        setError("Invalid API key. Please check your Gemini API key and try again.");
      } else {
        setError("Failed to get usage tips from AI. Please try again later.");
      }
    } finally {
      setLlmLoading(false);
    }
  };

  const getComparisonSummary = async () => {
    if (!selectedSession1 || !selectedSession2) {
      setError("Please select two sessions for comparison summary.");
      return;
    }

    setLlmLoading(true);
    setComparisonSummary(""); // Clear previous summary
    try {
      const prompt = `You are an expert energy analyst. Two energy usage projection scenarios are provided. Analyze their key differences in total projected cost, monthly usage patterns, and the impact of their respective tariff bands. Provide a concise summary, highlighting which scenario is more cost-effective and why, and any significant differences in usage or tariff structures that contribute to the cost difference.

Scenario 1 Name: ${selectedSession1.name}
Scenario 1 Total Projected Cost: £${selectedSession1.totalProjectedCost.toFixed(
        2
      )}
Scenario 1 Monthly Usage (kWh): ${selectedSession1.projectedUsage.join(", ")}
Scenario 1 Tariff Quarters:
- Q1 (Jul-Sep): Peak Unit Rate ${
        selectedSession1.tariffQuarters[0].peakUnitRate
      } p/kWh, Off-Peak Unit Rate ${
        selectedSession1.tariffQuarters[0].offPeakUnitRate
      } p/kWh, Standing Charge ${
        selectedSession1.tariffQuarters[0].standingCharge
      } p/day
- Q2 (Oct-Dec): Peak Unit Rate ${
        selectedSession1.tariffQuarters[1].peakUnitRate
      } p/kWh, Off-Peak Unit Rate ${
        selectedSession1.tariffQuarters[1].offPeakUnitRate
      } p/kWh, Standing Charge ${
        selectedSession1.tariffQuarters[1].standingCharge
      } p/day
- Q3 (Jan-Mar): Peak Unit Rate ${
        selectedSession1.tariffQuarters[2].peakUnitRate
      } p/kWh, Off-Peak Unit Rate ${
        selectedSession1.tariffQuarters[2].offPeakUnitRate
      } p/kWh, Standing Charge ${
        selectedSession1.tariffQuarters[2].standingCharge
      } p/day

Scenario 2 Name: ${selectedSession2.name}
Scenario 2 Total Projected Cost: £${selectedSession2.totalProjectedCost.toFixed(
        2
      )}
Scenario 2 Monthly Usage (kWh): ${selectedSession2.projectedUsage.join(", ")}
Scenario 2 Tariff Quarters:
- Q1 (Jul-Sep): Peak Unit Rate ${
        selectedSession2.tariffQuarters[0].peakUnitRate
      } p/kWh, Off-Peak Unit Rate ${
        selectedSession2.tariffQuarters[0].offPeakUnitRate
      } p/kWh, Standing Charge ${
        selectedSession2.tariffQuarters[0].standingCharge
      } p/day
- Q2 (Oct-Dec): Peak Unit Rate ${
        selectedSession2.tariffQuarters[1].peakUnitRate
      } p/kWh, Off-Peak Unit Rate ${
        selectedSession2.tariffQuarters[1].offPeakUnitRate
      } p/kWh, Standing Charge ${
        selectedSession2.tariffQuarters[1].standingCharge
      } p/day
- Q3 (Jan-Mar): Peak Unit Rate ${
        selectedSession2.tariffQuarters[2].peakUnitRate
      } p/kWh, Off-Peak Unit Rate ${
        selectedSession2.tariffQuarters[2].offPeakUnitRate
      } p/kWh, Standing Charge ${
        selectedSession2.tariffQuarters[2].standingCharge
      } p/day

Provide your analysis in clear, easy-to-understand language. Focus on the most impactful differences.`;

      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });
      const payload = { contents: chatHistory };
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();

      if (
        result.candidates &&
        result.candidates.length > 0 &&
        result.candidates[0].content &&
        result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0
      ) {
        const text = result.candidates[0].content.parts[0].text;
        setComparisonSummary(text);
        setError(null);
      } else {
        setError("AI did not return a valid comparison summary. Please check your API key and try again.");
        console.error("AI response structure unexpected:", result);
      }
    } catch (apiError) {
      console.error(
        "Error calling Gemini API for comparison summary:",
        apiError
      );
      if (apiError.message.includes('401') || apiError.message.includes('403')) {
        setError("Invalid API key. Please check your Gemini API key and try again.");
      } else {
        setError("Failed to get comparison summary from AI. Please try again later.");
      }
    } finally {
      setLlmLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-blue-600 text-lg font-medium">
          Loading application...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100 text-red-800 p-4 rounded-md">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 p-4 md:p-8">
      <Modal
        show={showModal}
        title={modalContent.title}
        message={modalContent.message}
        onConfirm={modalContent.onConfirm}
        onCancel={modalContent.onCancel}
        confirmText={modalContent.confirmText}
        cancelText={modalContent.cancelText}
      />

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">
              Configure Gemini AI
            </h3>
            <p className="mb-4 text-gray-700 text-sm">
              To use AI features, you need a Google Gemini API key. Get yours free at{" "}
              <a 
                href="https://makersuite.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Google AI Studio
              </a>
            </p>
            <div className="mb-4">
              <label
                htmlFor="apiKeyInput"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                API Key
              </label>
              <input
                type="password"
                id="apiKeyInput"
                className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your Gemini API key"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Your API key is stored locally in your browser and never sent to our servers.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowApiKeyModal(false);
                  setGeminiApiKey("");
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiKey}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-150"
                disabled={!geminiApiKey.trim()}
              >
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-4xl font-extrabold text-center text-blue-800 mb-8">
        Energy Forecast & Comparator
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Section */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md h-full">
          <h2 className="text-2xl font-semibold mb-6 text-blue-700">
            Forecast Inputs
          </h2>

          <div className="mb-4">
            <label
              htmlFor="usageBasis"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Monthly Usage Projection Basis (kWh, comma-separated, e.g., 200,
              180, ...)
            </label>
            <textarea
              id="usageBasis"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
              rows="3"
              value={monthlyUsageProjectionBasis}
              onChange={(e) => setMonthlyUsageProjectionBasis(e.target.value)}
            ></textarea>
            <p className="text-xs text-gray-500 mt-1">
              This pattern will be repeated to project for N months. Example:
              200, 180, 220, 300, 350, 400, 420, 380, 300, 250, 200, 180 (for
              July-June trend)
            </p>
          </div>

          <div className="mb-6">
            <label
              htmlFor="peakPercentage"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Peak Usage Percentage (%)
            </label>
            <input
              type="number"
              id="peakPercentage"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
              min="0"
              max="100"
              value={peakPercentage}
              onChange={(e) =>
                setPeakPercentage(
                  Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                )
              }
            />
            <p className="text-xs text-gray-500 mt-1">
              Off-peak usage will be (100 - Peak Usage Percentage)%.
            </p>
          </div>

          <div className="mb-6">
            <label
              htmlFor="nMonths"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Number of Months to Project (N)
            </label>
            <input
              type="number"
              id="nMonths"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
              min="1"
              value={nMonths}
              onChange={(e) =>
                setNMonths(Math.max(1, parseInt(e.target.value) || 1))
              }
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="currentMonth"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Current Month
            </label>
            <select
              id="currentMonth"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
              value={currentMonth}
              onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
            >
              <option value={1}>January</option>
              <option value={2}>February</option>
              <option value={3}>March</option>
              <option value={4}>April</option>
              <option value={5}>May</option>
              <option value={6}>June</option>
              <option value={7}>July</option>
              <option value={8}>August</option>
              <option value={9}>September</option>
              <option value={10}>October</option>
              <option value={11}>November</option>
              <option value={12}>December</option>
            </select>
          </div>

          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isFixedCharge}
                onChange={(e) => setIsFixedCharge(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-offset-0 focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Use Fixed Rates (No Seasonal Changes)
              </span>
            </label>
          </div>

          {isFixedCharge ? (
            <>
              <h3 className="text-xl font-semibold mb-4 text-blue-700">
                Fixed Tariff Rates (Pence)
              </h3>
              <div className="mb-4 p-3 border border-gray-200 rounded-md bg-green-50">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="fixedPeakUnitRate"
                      className="block text-xs font-medium text-gray-600 mb-1"
                    >
                      Peak Unit Rate (p/kWh)
                    </label>
                    <input
                      type="number"
                      id="fixedPeakUnitRate"
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                      step="0.01"
                      value={fixedRates.peakUnitRate}
                      onChange={(e) =>
                        setFixedRates({
                          ...fixedRates,
                          peakUnitRate: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="fixedStandingCharge"
                      className="block text-xs font-medium text-gray-600 mb-1"
                    >
                      Standing Charge (p/day)
                    </label>
                    <input
                      type="number"
                      id="fixedStandingCharge"
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                      step="0.01"
                      value={fixedRates.standingCharge}
                      onChange={(e) =>
                        setFixedRates({
                          ...fixedRates,
                          standingCharge: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-1">
                    <label
                      htmlFor="fixedOffPeakUnitRate"
                      className="block text-xs font-medium text-gray-600 mb-1"
                    >
                      Off-Peak Unit Rate (p/kWh)
                    </label>
                    <input
                      type="number"
                      id="fixedOffPeakUnitRate"
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                      step="0.01"
                      value={fixedRates.offPeakUnitRate}
                      onChange={(e) =>
                        setFixedRates({
                          ...fixedRates,
                          offPeakUnitRate: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  These fixed rates will be applied to all months without seasonal variations.
                </p>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-xl font-semibold mb-4 text-blue-700">
                Current Tariff Band (Pence)
              </h3>
              <div className="mb-4 p-3 border border-gray-200 rounded-md bg-gray-50">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="currentPeakUnitRate"
                      className="block text-xs font-medium text-gray-600 mb-1"
                    >
                      Peak Unit Rate (p/kWh)
                    </label>
                    <input
                      type="number"
                      id="currentPeakUnitRate"
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                      step="0.01"
                      value={currentTariffBand.peakUnitRate}
                      onChange={(e) =>
                        setCurrentTariffBand({
                          ...currentTariffBand,
                          peakUnitRate: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="currentStandingCharge"
                      className="block text-xs font-medium text-gray-600 mb-1"
                    >
                      Standing Charge (p/day)
                    </label>
                    <input
                      type="number"
                      id="currentStandingCharge"
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                      step="0.01"
                      value={currentTariffBand.standingCharge}
                      onChange={(e) =>
                        setCurrentTariffBand({
                          ...currentTariffBand,
                          standingCharge: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-1">
                    <label
                      htmlFor="currentOffPeakUnitRate"
                      className="block text-xs font-medium text-gray-600 mb-1"
                    >
                      Off-Peak Unit Rate (p/kWh)
                    </label>
                    <input
                      type="number"
                      id="currentOffPeakUnitRate"
                      className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                      step="0.01"
                      value={currentTariffBand.offPeakUnitRate}
                      onChange={(e) =>
                        setCurrentTariffBand({
                          ...currentTariffBand,
                          offPeakUnitRate: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <h3 className="text-xl font-semibold mb-4 text-blue-700">
                Predicted Future Tariff Bands (Editable)
              </h3>
              {tariffQuarters.slice(1).map((q, index) => (
                <div
                  key={index}
                  className="mb-4 p-3 border border-gray-200 rounded-md bg-gray-50"
                >
                  <h4 className="font-medium text-gray-800 mb-2">{q.name}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor={`futurePeakUnitRate-${index}`}
                        className="block text-xs font-medium text-gray-600 mb-1"
                      >
                        Peak Unit Rate (p/kWh)
                      </label>
                      <input
                        type="number"
                        id={`futurePeakUnitRate-${index}`}
                        className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                        step="0.01"
                        value={q.peakUnitRate}
                        onChange={(e) => {
                          const newTariffs = [...tariffQuarters];
                          newTariffs[index + 1].peakUnitRate =
                            parseFloat(e.target.value) || 0;
                          setTariffQuarters(newTariffs);
                        }}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`futureStandingCharge-${index}`}
                        className="block text-xs font-medium text-gray-600 mb-1"
                      >
                        Standing Charge (p/day)
                      </label>
                      <input
                        type="number"
                        id={`futureStandingCharge-${index}`}
                        className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                        step="0.01"
                        value={q.standingCharge}
                        onChange={(e) => {
                          const newTariffs = [...tariffQuarters];
                          newTariffs[index + 1].standingCharge =
                            parseFloat(e.target.value) || 0;
                          setTariffQuarters(newTariffs);
                        }}
                      />
                    </div>
                    <div className="col-span-1">
                      <label
                        htmlFor={`futureOffPeakUnitRate-${index}`}
                        className="block text-xs font-medium text-gray-600 mb-1"
                      >
                        Off-Peak Unit Rate (p/kWh)
                      </label>
                      <input
                        type="number"
                        id={`futureOffPeakUnitRate-${index}`}
                        className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                        step="0.01"
                        value={q.offPeakUnitRate}
                        onChange={(e) => {
                          const newTariffs = [...tariffQuarters];
                          newTariffs[index + 1].offPeakUnitRate =
                            parseFloat(e.target.value) || 0;
                          setTariffQuarters(newTariffs);
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-xs text-gray-500 mt-2">
                Future tariff bands are automatically calculated based on current rates with seasonal adjustments.
                Winter months (Oct-Mar) have 10% higher rates, summer months have 5% lower rates.
              </p>
            </>
          )}

          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4 text-blue-700">
              Session Management
            </h3>
            
            <div className="mb-4">
              <label
                htmlFor="loadSession"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Load Saved Session
              </label>
              <select
                id="loadSession"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                onChange={(e) => {
                  const sessionId = e.target.value;
                  if (sessionId) {
                    const session = savedSessions.find(s => s.id === sessionId);
                    if (session) {
                      handleLoadSession(session);
                    }
                  }
                }}
                value=""
              >
                <option value="">-- Select a session to load --</option>
                {savedSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name} ({new Date(session.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label
                htmlFor="sessionName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Session Name
              </label>
              <input
                type="text"
                id="sessionName"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g., Fixed Plan Scenario"
              />
            </div>
            
            <button
              onClick={handleSaveSession}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition duration-150 shadow-md"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Current Session"}
            </button>
          </div>
        </div>

        {/* Results and Charts Section */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-6 text-blue-700">
            Projected Energy Usage & Costs
          </h2>
          <div className="flex flex-col md:flex-row md:space-x-4 mb-8">
            <div className="flex-1 bg-blue-50 p-4 rounded-md shadow-sm mb-4 md:mb-0">
              <p className="text-lg font-medium text-blue-800">
                Total Projected Usage:
              </p>
              <p className="text-3xl font-bold text-blue-600">
                {projectedUsage.reduce((acc, curr) => acc + curr, 0).toFixed(0)}{" "}
                kWh
              </p>
            </div>
            <div className="flex-1 bg-red-50 p-4 rounded-md shadow-sm">
              <p className="text-lg font-medium text-red-800">
                Total Projected Cost:
              </p>
              <p className="text-3xl font-bold text-red-600">
                £{totalProjectedCost.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="chart-container mb-8">
            <canvas id="usageChart" ref={usageCanvasRef}></canvas>
          </div>
          <div className="chart-container mb-8">
            <canvas id="costChart" ref={costCanvasRef}></canvas>
          </div>

          <div className="mt-6 flex flex-col space-y-2">
            {geminiApiKey && (
              <div className="flex justify-between items-center p-2 bg-green-50 border border-green-200 rounded-md">
                <span className="text-sm text-green-700">
                  🔑 AI features enabled
                </span>
                <button
                  onClick={handleRemoveApiKey}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Remove Key
                </button>
              </div>
            )}
            
            <button
              onClick={() => checkApiKeyAndExecute(getUsageTips)}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition duration-150 shadow-md flex items-center justify-center"
              disabled={llmLoading || projectedUsage.length === 0}
            >
            {llmLoading ? (
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              "Get Usage Tips ✨"
            )}
            </button>
          </div>
          {usageTips && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
              <h3 className="font-semibold mb-2">Energy Saving Tips:</h3>
              <div className="prose prose-sm max-w-none text-yellow-800 prose-headings:text-yellow-900 prose-strong:text-yellow-900 prose-ul:text-yellow-800 prose-li:text-yellow-800">
                <ReactMarkdown>{usageTips}</ReactMarkdown>
              </div>
            </div>
          )}

          <h3 className="text-xl font-semibold mb-4 mt-8 text-blue-700">
            Detailed Monthly Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-md">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-700">
                    Month
                  </th>
                  <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-700">
                    Projected Usage (kWh)
                  </th>
                  <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-700">
                    Projected Cost (£)
                  </th>
                </tr>
              </thead>
              <tbody>
                {projectedUsage.map((usage, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b text-sm text-gray-900">
                      Month {index + 1}
                    </td>
                    <td className="py-2 px-4 border-b text-sm text-gray-900">
                      {usage.toFixed(0)}
                    </td>
                    <td className="py-2 px-4 border-b text-sm text-gray-900">
                      £
                      {projectedCosts[index]
                        ? projectedCosts[index].toFixed(2)
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-blue-50">
                <tr>
                  <td className="py-3 px-4 border-t-2 border-blue-200 text-sm font-semibold text-blue-900">
                    Total
                  </td>
                  <td className="py-3 px-4 border-t-2 border-blue-200 text-sm font-semibold text-blue-900">
                    {projectedUsage.reduce((acc, curr) => acc + curr, 0).toFixed(0)} kWh
                  </td>
                  <td className="py-3 px-4 border-t-2 border-blue-200 text-sm font-semibold text-blue-900">
                    £{totalProjectedCost.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Session Management and Comparison */}
      <div className="bg-white p-6 rounded-lg shadow-md mt-8">
        <h2 className="text-2xl font-semibold mb-6 text-blue-700">
          Saved Sessions & Comparison
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label
              htmlFor="selectSession1"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Select Session 1 for Comparison
            </label>
            <select
              id="selectSession1"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
              value={selectedSession1 ? selectedSession1.id : ""}
              onChange={(e) => {
                setSelectedSession1(
                  savedSessions.find((s) => s.id === e.target.value)
                );
                setComparisonSummary(""); // Clear summary on selection change
              }}
            >
              <option value="">-- Select Session --</option>
              {savedSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name} (
                  {new Date(session.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="selectSession2"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Select Session 2 for Comparison
            </label>
            <select
              id="selectSession2"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
              value={selectedSession2 ? selectedSession2.id : ""}
              onChange={(e) => {
                setSelectedSession2(
                  savedSessions.find((s) => s.id === e.target.value)
                );
                setComparisonSummary(""); // Clear summary on selection change
              }}
            >
              <option value="">-- Select Session --</option>
              {savedSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name} (
                  {new Date(session.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedSession1 && selectedSession2 && (
          <div className="mt-8 border-t pt-8 border-gray-200">
            <h3 className="text-xl font-semibold mb-4 text-blue-700">
              Comparison Charts
            </h3>
            <div className="flex flex-col md:flex-row md:space-x-4 mb-8">
              <div className="flex-1 bg-blue-50 p-4 rounded-md shadow-sm mb-4 md:mb-0">
                <p className="text-lg font-medium text-blue-800">
                  Total Cost 1 ({selectedSession1.name}):
                </p>
                <p className="text-3xl font-bold text-blue-600">
                  £{selectedSession1.totalProjectedCost.toFixed(2)}
                </p>
              </div>
              <div className="flex-1 bg-red-50 p-4 rounded-md shadow-sm">
                <p className="text-lg font-medium text-red-800">
                  Total Cost 2 ({selectedSession2.name}):
                </p>
                <p className="text-3xl font-bold text-red-600">
                  £{selectedSession2.totalProjectedCost.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="chart-container mb-8">
              <canvas
                id="compareUsageChart"
                ref={compareUsageCanvasRef}
              ></canvas>
            </div>
            <div className="chart-container">
              <canvas id="compareCostChart" ref={compareCostCanvasRef}></canvas>
            </div>

            <button
              onClick={() => checkApiKeyAndExecute(getComparisonSummary)}
              className="mt-6 w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-150 shadow-md flex items-center justify-center"
              disabled={llmLoading}
            >
              {llmLoading ? (
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
                "Summarize Comparison ✨"
              )}
            </button>
            {comparisonSummary && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-800">
                <h3 className="font-semibold mb-2">Comparison Summary:</h3>
                <div className="prose prose-sm max-w-none text-blue-800 prose-headings:text-blue-900 prose-strong:text-blue-900 prose-ul:text-blue-800 prose-li:text-blue-800">
                  <ReactMarkdown>{comparisonSummary}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
