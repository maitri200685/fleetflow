import React, { useState, useEffect } from "react";
import api from "../services/api";

export const AnalyticsPage = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Date Range Filter State
    const [dateRange, setDateRange] = useState("this_month"); // "today" | "this_week" | "this_month" | "last_3_months" | "this_year" | "custom"
    const [customStartDate, setCustomStartDate] = useState("");
    const [customEndDate, setCustomEndDate] = useState("");

    // Selected Report for Export
    const [selectedReportType, setSelectedReportType] = useState("overall");

    // Analytics Datasets
    const [overview, setOverview] = useState({});
    const [tripsData, setTripsData] = useState({});
    const [finData, setFinData] = useState({});
    const [fuelData, setFuelData] = useState({});
    const [maintData, setMaintData] = useState({});
    const [utilData, setUtilData] = useState({});
    const [insights, setInsights] = useState([]);

    // Calculate dates based on preset
    const getDateParams = () => {
        const today = new Date();
        let start = "";
        let end = today.toISOString().split("T")[0];

        if (dateRange === "today") {
            start = end;
        } else if (dateRange === "this_week") {
            const d = new Date(today);
            d.setDate(d.getDate() - 7);
            start = d.toISOString().split("T")[0];
        } else if (dateRange === "this_month") {
            const d = new Date(today.getFullYear(), today.getMonth(), 1);
            start = d.toISOString().split("T")[0];
        } else if (dateRange === "last_3_months") {
            const d = new Date(today);
            d.setMonth(d.getMonth() - 3);
            start = d.toISOString().split("T")[0];
        } else if (dateRange === "this_year") {
            const d = new Date(today.getFullYear(), 0, 1);
            start = d.toISOString().split("T")[0];
        } else if (dateRange === "custom") {
            start = customStartDate;
            end = customEndDate;
        }

        const params = [];
        if (start) params.push(`start_date=${start}`);
        if (end) params.push(`end_date=${end}`);
        return params.length > 0 ? `?${params.join("&")}` : "";
    };

    const fetchAllAnalytics = async () => {
        setLoading(true);
        setError("");
        try {
            const qStr = getDateParams();
            const [oRes, tRes, fRes, fuRes, mRes, uRes, rRes] = await Promise.all([
                api.get("/analytics/overview"),
                api.get(`/analytics/trips${qStr}`),
                api.get(`/analytics/financial${qStr}`),
                api.get(`/analytics/fuel${qStr}`),
                api.get(`/analytics/maintenance${qStr}`),
                api.get(`/analytics/utilization${qStr}`),
                api.get(`/analytics/report${qStr}&type=${selectedReportType}`)
            ]);

            if (oRes.data?.success) setOverview(oRes.data.data || {});
            if (tRes.data?.success) setTripsData(tRes.data.data || {});
            if (fRes.data?.success) setFinData(fRes.data.data || {});
            if (fuRes.data?.success) setFuelData(fuRes.data.data || {});
            if (mRes.data?.success) setMaintData(mRes.data.data || {});
            if (uRes.data?.success) setUtilData(uRes.data.data || {});
            if (rRes.data?.success) setInsights(rRes.data.data.executive_insights || []);

        } catch (err) {
            console.error("Error loading analytics:", err);
            setError(err.response?.data?.message || "Failed to load executive analytics data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllAnalytics();
    }, [dateRange, customStartDate, customEndDate, selectedReportType]);

    // CSV Export Handler
    const handleExportCSV = () => {
        const rows = [
            ["Metric Category", "Metric Name", "Value"],
            ["Fleet Overview", "Total Vehicles", overview.total_vehicles || 0],
            ["Fleet Overview", "Available Vehicles", overview.available_vehicles || 0],
            ["Fleet Overview", "Vehicles in Transit", overview.vehicles_in_transit || 0],
            ["Fleet Overview", "Vehicles in Maintenance", overview.vehicles_under_maintenance || 0],
            ["Fleet Overview", "Total Drivers", overview.total_drivers || 0],
            ["Fleet Overview", "Total Customers", overview.total_customers || 0],
            ["Trip Performance", "Total Trips", tripsData.total_trips || 0],
            ["Trip Performance", "Completed Trips", tripsData.completed_trips || 0],
            ["Trip Performance", "In Transit Trips", tripsData.in_transit_trips || 0],
            ["Trip Performance", "Cancelled Trips", tripsData.cancelled_trips || 0],
            ["Financials", "Total Operating Cost ($)", finData.total_expenses || 0],
            ["Financials", "Fuel Expenditure ($)", finData.fuel_cost || 0],
            ["Financials", "Maintenance Cost ($)", finData.maintenance_cost || 0],
            ["Fuel Logging", "Total Fuel (Liters)", fuelData.total_liters || 0],
            ["Fuel Logging", "Average Fuel Efficiency (km/L)", fuelData.average_fuel_efficiency || 0],
            ["Utilization", "Fleet Utilization Rate (%)", utilData.vehicle_utilization_indicators?.fleet_utilization_rate || 0]
        ];

        const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `FleetFlow_Analytics_${selectedReportType}_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // PDF / Print Export Handler
    const handleExportPDF = () => {
        window.print();
    };

    return (
        <div className="analytics-container" style={{ paddingBottom: "2rem" }}>
            {/* Top Page Header */}
            <div className="flex-between mb-6" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h2 className="header-title" style={{ fontSize: "1.75rem", fontWeight: "700", margin: 0 }}>
                        Fleet Analytics
                    </h2>
                    <p className="text-muted" style={{ fontSize: "0.9rem", marginTop: "0.2rem" }}>
                        Operational performance and financial insights
                    </p>
                </div>

                {/* Controls: Date Filter & Report Actions */}
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", backgroundColor: "#0f172a", padding: "0.4rem 0.75rem", borderRadius: "8px", border: "1px solid #1e293b" }}>
                        <span style={{ fontSize: "0.85rem", color: "#9ca3af", fontWeight: "600" }}>Period:</span>
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            style={{ background: "transparent", color: "#ffffff", border: "none", outline: "none", fontSize: "0.85rem", fontWeight: "600", cursor: "pointer" }}
                        >
                            <option value="today" style={{ background: "#0f172a" }}>Today</option>
                            <option value="this_week" style={{ background: "#0f172a" }}>This Week</option>
                            <option value="this_month" style={{ background: "#0f172a" }}>This Month</option>
                            <option value="last_3_months" style={{ background: "#0f172a" }}>Last 3 Months</option>
                            <option value="this_year" style={{ background: "#0f172a" }}>This Year</option>
                            <option value="custom" style={{ background: "#0f172a" }}>Custom Range</option>
                        </select>
                    </div>

                    {dateRange === "custom" && (
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                style={{ backgroundColor: "#0f172a", color: "#ffffff", border: "1px solid #1e293b", borderRadius: "6px", padding: "0.35rem 0.6rem", fontSize: "0.85rem" }}
                            />
                            <span style={{ color: "#64748b" }}>to</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                style={{ backgroundColor: "#0f172a", color: "#ffffff", border: "1px solid #1e293b", borderRadius: "6px", padding: "0.35rem 0.6rem", fontSize: "0.85rem" }}
                            />
                        </div>
                    )}

                    <select
                        value={selectedReportType}
                        onChange={(e) => setSelectedReportType(e.target.value)}
                        style={{ backgroundColor: "#0f172a", color: "#ffffff", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.45rem 0.75rem", fontSize: "0.85rem" }}
                    >
                        <option value="overall">Overall Fleet Report</option>
                        <option value="financial">Financial Report</option>
                        <option value="fuel">Fuel Report</option>
                        <option value="maintenance">Maintenance Report</option>
                        <option value="trips">Trip Report</option>
                        <option value="utilization">Utilization Report</option>
                    </select>

                    <button onClick={handleExportCSV} className="btn btn-outline" style={{ background: "#1e293b", color: "#ffffff", fontSize: "0.85rem" }}>
                        📥 Export CSV
                    </button>
                    <button onClick={handleExportPDF} className="btn btn-primary" style={{ fontSize: "0.85rem" }}>
                        🖨️ Print / PDF
                    </button>
                </div>
            </div>

            {/* Error State Banner */}
            {error && (
                <div className="alert alert-danger mb-6" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>⚠️ {error}</span>
                    <button onClick={fetchAllAnalytics} className="btn btn-sm btn-outline-danger" style={{ color: "#ffffff", borderColor: "#ffffff" }}>
                        Retry
                    </button>
                </div>
            )}

            {/* Compact Professional KPI Cards Grid (8 Cards) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                <div className="stat-card" style={{ padding: "1rem" }}>
                    <div className="stat-icon icon-blue" style={{ width: "38px", height: "38px", fontSize: "1.2rem" }}>🚛</div>
                    <div className="stat-data">
                        <div className="stat-value" style={{ fontSize: "1.35rem" }}>{loading ? "..." : overview.total_vehicles || 0}</div>
                        <div className="stat-label" style={{ fontSize: "0.78rem" }}>Fleet Size</div>
                    </div>
                </div>

                <div className="stat-card" style={{ padding: "1rem" }}>
                    <div className="stat-icon icon-green" style={{ width: "38px", height: "38px", fontSize: "1.2rem" }}>✅</div>
                    <div className="stat-data">
                        <div className="stat-value" style={{ fontSize: "1.35rem" }}>{loading ? "..." : overview.available_vehicles || 0}</div>
                        <div className="stat-label" style={{ fontSize: "0.78rem" }}>Available Vehicles</div>
                    </div>
                </div>

                <div className="stat-card" style={{ padding: "1rem" }}>
                    <div className="stat-icon icon-amber" style={{ width: "38px", height: "38px", fontSize: "1.2rem" }}>🗺️</div>
                    <div className="stat-data">
                        <div className="stat-value" style={{ fontSize: "1.35rem" }}>{loading ? "..." : overview.active_trips || 0}</div>
                        <div className="stat-label" style={{ fontSize: "0.78rem" }}>Active Trips</div>
                    </div>
                </div>

                <div className="stat-card" style={{ padding: "1rem" }}>
                    <div className="stat-icon icon-purple" style={{ width: "38px", height: "38px", fontSize: "1.2rem", background: "rgba(168, 85, 247, 0.15)" }}>🏁</div>
                    <div className="stat-data">
                        <div className="stat-value" style={{ fontSize: "1.35rem" }}>{loading ? "..." : overview.completed_trips || 0}</div>
                        <div className="stat-label" style={{ fontSize: "0.78rem" }}>Completed Trips</div>
                    </div>
                </div>

                <div className="stat-card" style={{ padding: "1rem" }}>
                    <div className="stat-icon icon-indigo" style={{ width: "38px", height: "38px", fontSize: "1.2rem", background: "rgba(99, 102, 241, 0.15)" }}>👨‍✈️</div>
                    <div className="stat-data">
                        <div className="stat-value" style={{ fontSize: "1.35rem" }}>{loading ? "..." : overview.total_drivers || 0}</div>
                        <div className="stat-label" style={{ fontSize: "0.78rem" }}>Active Drivers</div>
                    </div>
                </div>

                <div className="stat-card" style={{ padding: "1rem" }}>
                    <div className="stat-icon" style={{ width: "38px", height: "38px", fontSize: "1.2rem", background: "rgba(239, 68, 68, 0.15)" }}>🛠️</div>
                    <div className="stat-data">
                        <div className="stat-value" style={{ fontSize: "1.35rem" }}>{loading ? "..." : overview.vehicles_under_maintenance || 0}</div>
                        <div className="stat-label" style={{ fontSize: "0.78rem" }}>In Maintenance</div>
                    </div>
                </div>

                <div className="stat-card" style={{ padding: "1rem" }}>
                    <div className="stat-icon" style={{ width: "38px", height: "38px", fontSize: "1.2rem", background: "rgba(14, 165, 233, 0.15)" }}>🏢</div>
                    <div className="stat-data">
                        <div className="stat-value" style={{ fontSize: "1.35rem" }}>{loading ? "..." : overview.total_customers || 0}</div>
                        <div className="stat-label" style={{ fontSize: "0.78rem" }}>Total Customers</div>
                    </div>
                </div>

                <div className="stat-card" style={{ padding: "1rem" }}>
                    <div className="stat-icon icon-green" style={{ width: "38px", height: "38px", fontSize: "1.2rem" }}>💳</div>
                    <div className="stat-data">
                        <div className="stat-value" style={{ fontSize: "1.25rem", color: "#10b981" }}>
                            {loading ? "..." : `$${(finData.total_expenses || 0).toLocaleString()}`}
                        </div>
                        <div className="stat-label" style={{ fontSize: "0.78rem" }}>Operating Cost</div>
                    </div>
                </div>
            </div>

            {/* Executive Insights Banner */}
            <div className="card glass-card p-5 mb-8" style={{ borderLeft: "4px solid #3b82f6" }}>
                <h3 className="font-semibold text-main mb-2" style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    💡 Executive Fleet Insights
                </h3>
                {insights.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: "0.85rem", margin: 0 }}>Gathering live fleet telemetry and operational insights...</p>
                ) : (
                    <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#cbd5e1", fontSize: "0.88rem", lineHeight: 1.6 }}>
                        {insights.map((item, idx) => (
                            <li key={idx}>{item}</li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Main Sections Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>

                {/* TRIP PERFORMANCE SECTION */}
                <div className="card glass-card p-6">
                    <h3 className="card-title mb-4" style={{ fontSize: "1.1rem" }}>🗺️ Trip Performance & Dispatch</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                        <div style={{ background: "#0f172a", padding: "1rem", borderRadius: "8px" }}>
                            <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Total Dispatches</div>
                            <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#ffffff" }}>{tripsData.total_trips || 0}</div>
                        </div>
                        <div style={{ background: "#0f172a", padding: "1rem", borderRadius: "8px" }}>
                            <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Completed Ratio</div>
                            <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#10b981" }}>
                                {tripsData.total_trips > 0 ? Math.round((tripsData.completed_trips / tripsData.total_trips) * 100) : 0}%
                            </div>
                        </div>
                    </div>

                    <h4 style={{ fontSize: "0.9rem", color: "#9ca3af", marginBottom: "0.5rem" }}>Top Vehicles by Trip Activity</h4>
                    <div className="table-responsive">
                        <table style={{ width: "100%", fontSize: "0.85rem", textAlign: "left" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid #1e293b", color: "#64748b" }}>
                                    <th style={{ padding: "0.5rem" }}>Vehicle</th>
                                    <th style={{ padding: "0.5rem" }}>Total Trips</th>
                                    <th style={{ padding: "0.5rem" }}>Completed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(tripsData.trips_by_vehicle || []).slice(0, 5).map((v) => (
                                    <tr key={v.vehicle_id} style={{ borderBottom: "1px solid #0f172a" }}>
                                        <td style={{ padding: "0.5rem", fontWeight: "600" }}>{v.vehicle_number}</td>
                                        <td style={{ padding: "0.5rem" }}>{v.count}</td>
                                        <td style={{ padding: "0.5rem", color: "#10b981" }}>{v.completed_count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FINANCIAL BREAKDOWN SECTION */}
                <div className="card glass-card p-6">
                    <h3 className="card-title mb-4" style={{ fontSize: "1.1rem" }}>💳 Financial Breakdown & Operating Cost</h3>
                    <div style={{ marginBottom: "1rem" }}>
                        <div style={{ fontSize: "0.82rem", color: "#9ca3af", marginBottom: "0.2rem" }}>Total Operating Expenditure</div>
                        <div style={{ fontSize: "1.8rem", fontWeight: "700", color: "#10b981" }}>
                            ${(finData.total_expenses || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </div>
                    </div>

                    <h4 style={{ fontSize: "0.9rem", color: "#9ca3af", marginBottom: "0.5rem" }}>Expenses by Category</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        {(finData.category_breakdown || []).slice(0, 5).map((cat) => (
                            <div key={cat.category}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "0.2rem" }}>
                                    <span style={{ color: "#cbd5e1" }}>{cat.category}</span>
                                    <span style={{ color: "#ffffff", fontWeight: "600" }}>${cat.amount.toLocaleString()} ({cat.percentage}%)</span>
                                </div>
                                <div style={{ height: "6px", backgroundColor: "#0f172a", borderRadius: "3px", overflow: "hidden" }}>
                                    <div style={{ width: `${Math.min(cat.percentage, 100)}%`, backgroundColor: "#3b82f6", height: "100%" }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* FUEL LOGGING & EFFICIENCY SECTION */}
                <div className="card glass-card p-6">
                    <h3 className="card-title mb-4" style={{ fontSize: "1.1rem" }}>⛽ Fuel Logging & Efficiency</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                        <div style={{ background: "#0f172a", padding: "0.85rem", borderRadius: "8px" }}>
                            <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>Total Refueled</div>
                            <div style={{ fontSize: "1.3rem", fontWeight: "700", color: "#ffffff" }}>{(fuelData.total_liters || 0).toLocaleString()} L</div>
                        </div>
                        <div style={{ background: "#0f172a", padding: "0.85rem", borderRadius: "8px" }}>
                            <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>Avg Efficiency</div>
                            <div style={{ fontSize: "1.3rem", fontWeight: "700", color: "#60a5fa" }}>{fuelData.average_fuel_efficiency || 0} km/L</div>
                        </div>
                    </div>

                    <h4 style={{ fontSize: "0.9rem", color: "#9ca3af", marginBottom: "0.5rem" }}>Vehicle Fuel Consumption</h4>
                    <div className="table-responsive">
                        <table style={{ width: "100%", fontSize: "0.85rem", textAlign: "left" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid #1e293b", color: "#64748b" }}>
                                    <th style={{ padding: "0.5rem" }}>Vehicle</th>
                                    <th style={{ padding: "0.5rem" }}>Liters</th>
                                    <th style={{ padding: "0.5rem" }}>Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(fuelData.vehicle_wise_fuel_consumption || []).slice(0, 5).map((f) => (
                                    <tr key={f.vehicle_id} style={{ borderBottom: "1px solid #0f172a" }}>
                                        <td style={{ padding: "0.5rem", fontWeight: "600" }}>{f.vehicle_number}</td>
                                        <td style={{ padding: "0.5rem" }}>{f.total_liters} L</td>
                                        <td style={{ padding: "0.5rem", color: "#10b981" }}>${f.total_cost}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* MAINTENANCE & RELIABILITY SECTION */}
                <div className="card glass-card p-6">
                    <h3 className="card-title mb-4" style={{ fontSize: "1.1rem" }}>🛠️ Maintenance & Asset Reliability</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                        <div style={{ background: "#0f172a", padding: "0.85rem", borderRadius: "8px" }}>
                            <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>Service Records</div>
                            <div style={{ fontSize: "1.3rem", fontWeight: "700", color: "#ffffff" }}>{maintData.total_maintenance_records || 0}</div>
                        </div>
                        <div style={{ background: "#0f172a", padding: "0.85rem", borderRadius: "8px" }}>
                            <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>Maintenance Cost</div>
                            <div style={{ fontSize: "1.3rem", fontWeight: "700", color: "#ef4444" }}>
                                ${(maintData.total_maintenance_cost || 0).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <h4 style={{ fontSize: "0.9rem", color: "#9ca3af", marginBottom: "0.5rem" }}>Vehicles Currently in Maintenance</h4>
                    {(maintData.vehicles_currently_under_maintenance || []).length === 0 ? (
                        <div style={{ fontSize: "0.85rem", color: "#10b981", background: "#0f172a", padding: "0.75rem", borderRadius: "6px" }}>
                            ✅ All fleet vehicles are currently active & operational.
                        </div>
                    ) : (
                        <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem", color: "#cbd5e1" }}>
                            {(maintData.vehicles_currently_under_maintenance || []).map((vm) => (
                                <li key={vm.vehicle_id} style={{ marginBottom: "0.3rem" }}>
                                    <strong>{vm.vehicle_number}</strong> — {vm.service_type || 'Service'} ({vm.vehicle_status})
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

            </div>

            {/* FLEET UTILIZATION TABLES SECTION */}
            <div className="card glass-card p-6 mb-8">
                <h3 className="card-title mb-4" style={{ fontSize: "1.1rem" }}>📊 Fleet Asset Utilization Matrix</h3>

                <div className="table-responsive mb-6">
                    <table style={{ width: "100%", fontSize: "0.88rem", textAlign: "left" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid #2a3447", color: "#9ca3af" }}>
                                <th style={{ padding: "0.75rem" }}>Vehicle Number</th>
                                <th style={{ padding: "0.75rem" }}>Status</th>
                                <th style={{ padding: "0.75rem" }}>Total Trips</th>
                                <th style={{ padding: "0.75rem" }}>Completed</th>
                                <th style={{ padding: "0.75rem" }}>Cancelled</th>
                                <th style={{ padding: "0.75rem" }}>Utilization Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(utilData.vehicle_trip_counts || []).slice(0, 10).map((v) => (
                                <tr key={v.vehicle_id} style={{ borderBottom: "1px solid #1e293b" }}>
                                    <td style={{ padding: "0.75rem", fontWeight: "600" }}>{v.vehicle_number}</td>
                                    <td style={{ padding: "0.75rem" }}>
                                        <span className="role-pill">{v.status}</span>
                                    </td>
                                    <td style={{ padding: "0.75rem" }}>{v.trip_count}</td>
                                    <td style={{ padding: "0.75rem", color: "#10b981" }}>{v.completed_count}</td>
                                    <td style={{ padding: "0.75rem", color: "#ef4444" }}>{v.cancelled_count}</td>
                                    <td style={{ padding: "0.75rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <span>{v.utilization_percentage}%</span>
                                            <div style={{ flex: 1, height: "6px", background: "#0f172a", borderRadius: "3px", overflow: "hidden" }}>
                                                <div style={{ width: `${v.utilization_percentage}%`, background: "#10b981", height: "100%" }}></div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h3 className="card-title mb-4" style={{ fontSize: "1.1rem" }}>👨‍✈️ Driver Performance & Dispatch Matrix</h3>
                <div className="table-responsive">
                    <table style={{ width: "100%", fontSize: "0.88rem", textAlign: "left" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid #2a3447", color: "#9ca3af" }}>
                                <th style={{ padding: "0.75rem" }}>Driver Name</th>
                                <th style={{ padding: "0.75rem" }}>Status</th>
                                <th style={{ padding: "0.75rem" }}>Total Trips</th>
                                <th style={{ padding: "0.75rem" }}>Completed</th>
                                <th style={{ padding: "0.75rem" }}>Cancelled</th>
                                <th style={{ padding: "0.75rem" }}>Completion Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(utilData.driver_trip_counts || []).slice(0, 10).map((d) => (
                                <tr key={d.driver_id} style={{ borderBottom: "1px solid #1e293b" }}>
                                    <td style={{ padding: "0.75rem", fontWeight: "600" }}>{d.driver_name}</td>
                                    <td style={{ padding: "0.75rem" }}>
                                        <span className="role-pill">{d.status}</span>
                                    </td>
                                    <td style={{ padding: "0.75rem" }}>{d.trip_count}</td>
                                    <td style={{ padding: "0.75rem", color: "#10b981" }}>{d.completed_count}</td>
                                    <td style={{ padding: "0.75rem", color: "#ef4444" }}>{d.cancelled_count}</td>
                                    <td style={{ padding: "0.75rem" }}>
                                        <span style={{ fontWeight: "600", color: d.completion_rate >= 80 ? "#10b981" : "#f59e0b" }}>
                                            {d.completion_rate}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPage;
