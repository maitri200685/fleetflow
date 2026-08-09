import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import api from "../services/api";

export const DashboardPage = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalVehicles: 0,
        availableVehicles: 0,
        totalDrivers: 0,
        activeTrips: 0,
        completedTrips: 0,
        utilizationRate: 0,
        monthlyOperatingCost: 0,
        avgFuelEfficiency: 0
    });
    const [recentTrips, setRecentTrips] = useState([]);
    const [recentAlerts, setRecentAlerts] = useState([]);

    useEffect(() => {
        let isMounted = true;

        const fetchDashboardData = async () => {
            try {
                // Fetch Overview & Analytics
                let vCount = 0;
                let vAvailable = 0;
                let dCount = 0;
                let tActive = 0;
                let tCompleted = 0;
                let tripsList = [];
                let utilPct = 0;
                let opCost = 0;
                let avgEff = 0;

                try {
                    const [vRes, dRes, tRes, uRes, fRes, fuRes] = await Promise.all([
                        api.get("/vehicles"),
                        api.get("/drivers"),
                        api.get("/trips"),
                        api.get("/analytics/utilization"),
                        api.get("/analytics/financial"),
                        api.get("/analytics/fuel")
                    ]);

                    if (vRes.data?.data) {
                        vCount = vRes.data.count || vRes.data.data.length || 0;
                        vAvailable = vRes.data.data.filter((v) => (v.status || "").toUpperCase() === "AVAILABLE").length;
                    }
                    if (dRes.data?.data) {
                        dCount = dRes.data.count || dRes.data.data.length || 0;
                    }
                    if (tRes.data?.data) {
                        tripsList = tRes.data.data;
                        tActive = tripsList.filter((t) => t.status === "In Transit" || t.status === "Assigned").length;
                        tCompleted = tripsList.filter((t) => t.status === "Completed").length;
                    }
                    if (uRes.data?.data?.vehicle_utilization_indicators) {
                        utilPct = uRes.data.data.vehicle_utilization_indicators.fleet_utilization_rate || 0;
                    }
                    if (fRes.data?.data) {
                        opCost = fRes.data.data.total_expenses || 0;
                    }
                    if (fuRes.data?.data) {
                        avgEff = fuRes.data.data.average_fuel_efficiency || 0;
                    }

                } catch (err) {
                    console.error("Error fetching dashboard telemetry:", err);
                }

                // Fetch Recent Alerts
                let alertsList = [];
                try {
                    const nRes = await api.get("/notifications?limit=4");
                    if (nRes.data?.data) {
                        alertsList = nRes.data.data;
                    }
                } catch {
                    // Fallback
                }

                if (isMounted) {
                    setStats({
                        totalVehicles: vCount,
                        availableVehicles: vAvailable,
                        totalDrivers: dCount,
                        activeTrips: tActive,
                        completedTrips: tCompleted,
                        utilizationRate: utilPct,
                        monthlyOperatingCost: opCost,
                        avgFuelEfficiency: avgEff
                    });
                    setRecentTrips(tripsList.slice(0, 5));
                    setRecentAlerts(alertsList.slice(0, 4));
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchDashboardData();

        return () => {
            isMounted = false;
        };
    }, []);

    // Severity Icon Helper
    const getAlertIcon = (severity) => {
        const s = (severity || "info").toLowerCase();
        if (s === "critical") return "🔴";
        if (s === "warning") return "🟠";
        if (s === "success") return "🟢";
        return "🔵";
    };

    return (
        <div className="dashboard-container">
            {/* Hero Welcome Banner */}
            <div className="card glass-card hero-card mb-6">
                <div className="hero-content">
                    <div className="hero-badge">ENTERPRISE CONSOLE</div>
                    <h2 className="hero-title">
                        Welcome back, <span className="text-primary">{user?.name || "User"}</span>!
                    </h2>
                    <p className="hero-description">
                        FleetFlow Management Platform — Real-time telemetry, trip dispatching, driver assignments, and vehicle asset lifecycle control.
                    </p>
                    <div className="hero-user-details mt-4">
                        <span className="info-chip"><strong>Account ID:</strong> {user?.id}</span>
                        <span className="info-chip"><strong>System Role:</strong> {user?.role}</span>
                        <span className="info-chip text-success"><strong>Status:</strong> {user?.status || "ACTIVE"}</span>
                    </div>
                </div>
            </div>

            {/* Dashboard Statistic Cards (5 Required Cards) */}
            <div className="grid grid-cols-5 gap-4 mb-8" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <div className="stat-card">
                    <div className="stat-icon icon-blue">🚛</div>
                    <div className="stat-data">
                        <div className="stat-value">{loading ? "..." : stats.totalVehicles}</div>
                        <div className="stat-label">Total Vehicles</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon icon-green">✅</div>
                    <div className="stat-data">
                        <div className="stat-value">{loading ? "..." : stats.availableVehicles}</div>
                        <div className="stat-label">Available Vehicles</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon icon-indigo" style={{ background: "rgba(99, 102, 241, 0.15)" }}>👨‍✈️</div>
                    <div className="stat-data">
                        <div className="stat-value">{loading ? "..." : stats.totalDrivers}</div>
                        <div className="stat-label">Total Drivers</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon icon-amber">🗺️</div>
                    <div className="stat-data">
                        <div className="stat-value">{loading ? "..." : stats.activeTrips}</div>
                        <div className="stat-label">Active Trips</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon icon-purple" style={{ background: "rgba(168, 85, 247, 0.15)" }}>🏁</div>
                    <div className="stat-data">
                        <div className="stat-value">{loading ? "..." : stats.completedTrips}</div>
                        <div className="stat-label">Completed Trips</div>
                    </div>
                </div>
            </div>

            {/* Fleet Performance Summary Section (Module 11) */}
            <div className="card glass-card p-6 mb-8" style={{ borderLeft: "4px solid #3b82f6" }}>
                <div className="flex-between mb-4" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span>📈 Fleet Performance Overview</span>
                    </h3>
                    <Link to="/analytics" className="btn btn-sm btn-primary" style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}>
                        View Analytics →
                    </Link>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
                    <div style={{ background: "#0f172a", padding: "1rem", borderRadius: "8px" }}>
                        <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Fleet Utilization</div>
                        <div style={{ fontSize: "1.4rem", fontWeight: "700", color: "#10b981", marginTop: "0.2rem" }}>
                            {loading ? "..." : `${stats.utilizationRate}%`}
                        </div>
                    </div>

                    <div style={{ background: "#0f172a", padding: "1rem", borderRadius: "8px" }}>
                        <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Active Trips</div>
                        <div style={{ fontSize: "1.4rem", fontWeight: "700", color: "#60a5fa", marginTop: "0.2rem" }}>
                            {loading ? "..." : stats.activeTrips}
                        </div>
                    </div>

                    <div style={{ background: "#0f172a", padding: "1rem", borderRadius: "8px" }}>
                        <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Operating Cost</div>
                        <div style={{ fontSize: "1.4rem", fontWeight: "700", color: "#ffffff", marginTop: "0.2rem" }}>
                            {loading ? "..." : `$${stats.monthlyOperatingCost.toLocaleString()}`}
                        </div>
                    </div>

                    <div style={{ background: "#0f172a", padding: "1rem", borderRadius: "8px" }}>
                        <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>Avg Fuel Efficiency</div>
                        <div style={{ fontSize: "1.4rem", fontWeight: "700", color: "#f59e0b", marginTop: "0.2rem" }}>
                            {loading ? "..." : `${stats.avgFuelEfficiency} km/L`}
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Fleet Operational Alerts Section */}
            <div className="card glass-card p-6 mb-8">
                <div className="flex-between mb-4" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span>🔔 Recent Fleet Alerts</span>
                    </h3>
                    <Link to="/notifications" className="btn btn-sm btn-outline-primary" style={{ padding: "0.3rem 0.75rem", fontSize: "0.85rem" }}>
                        View All Notifications →
                    </Link>
                </div>

                {loading ? (
                    <div className="p-4 text-center text-muted">Scanning fleet alerts...</div>
                ) : recentAlerts.length === 0 ? (
                    <div className="p-6 text-center" style={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px dashed #2a3447" }}>
                        <div style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>✅</div>
                        <p className="text-muted" style={{ fontSize: "0.9rem" }}>No critical fleet operational alerts detected.</p>
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.85rem" }}>
                        {recentAlerts.map((a) => (
                            <div
                                key={a.id}
                                style={{
                                    backgroundColor: "#0f172a",
                                    padding: "0.85rem 1rem",
                                    borderRadius: "8px",
                                    borderLeft: a.severity === "critical" ? "4px solid #ef4444" : a.severity === "warning" ? "4px solid #f59e0b" : "4px solid #3b82f6",
                                    borderTop: "1px solid #1e293b",
                                    borderRight: "1px solid #1e293b",
                                    borderBottom: "1px solid #1e293b"
                                }}
                            >
                                <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "#ffffff", display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem" }}>
                                    <span>{getAlertIcon(a.severity)}</span>
                                    <span>{a.title}</span>
                                </div>
                                <div style={{ fontSize: "0.82rem", color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                                    {a.message}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Recent Trips Section */}
            <div className="card glass-card p-6 mb-8">
                <div className="flex-between mb-4" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 className="card-title">Recent Trips</h3>
                    <Link to="/trips" className="btn btn-sm btn-outline-primary" style={{ padding: "0.3rem 0.75rem", fontSize: "0.85rem" }}>
                        View All Trips →
                    </Link>
                </div>

                {loading ? (
                    <div className="p-6 text-center text-muted">Loading trips data...</div>
                ) : recentTrips.length === 0 ? (
                    <div className="p-8 text-center" style={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px dashed #2a3447" }}>
                        <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🗺️</div>
                        <h4 className="font-semibold text-main mb-1" style={{ fontSize: "1.1rem" }}>No trips available yet.</h4>
                        <p className="text-muted" style={{ fontSize: "0.85rem" }}>Trips created and assigned in the FleetFlow system will appear here.</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid #2a3447", color: "#9ca3af" }}>
                                    <th style={{ padding: "0.75rem" }}>Trip Code</th>
                                    <th style={{ padding: "0.75rem" }}>Origin</th>
                                    <th style={{ padding: "0.75rem" }}>Destination</th>
                                    <th style={{ padding: "0.75rem" }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentTrips.map((t) => (
                                    <tr key={t.id} style={{ borderBottom: "1px solid #1e293b" }}>
                                        <td style={{ padding: "0.75rem", fontWeight: "600" }}>{t.trip_code || t.trip_number}</td>
                                        <td style={{ padding: "0.75rem" }}>{t.origin || t.source}</td>
                                        <td style={{ padding: "0.75rem" }}>{t.destination}</td>
                                        <td style={{ padding: "0.75rem" }}>
                                            <span className="role-pill">{t.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Quick Navigation Modules Grid */}
            <div className="card glass-card p-6">
                <h3 className="card-title mb-4">FleetFlow System Operations</h3>
                <div className="grid grid-cols-3 gap-4">
                    <Link to="/analytics" className="module-card">
                        <div className="module-icon">📈</div>
                        <div className="module-title">Fleet Analytics</div>
                        <div className="module-desc">Executive insights, costs, fuel efficiency, and reports</div>
                    </Link>

                    <Link to="/vehicles" className="module-card">
                        <div className="module-icon">🚛</div>
                        <div className="module-title">Vehicles Management</div>
                        <div className="module-desc">Fleet asset capacity, mileage, and active status</div>
                    </Link>

                    <Link to="/drivers" className="module-card">
                        <div className="module-icon">👨‍✈️</div>
                        <div className="module-title">Driver Registry</div>
                        <div className="module-desc">Driver licenses, phone contacts, and assignment status</div>
                    </Link>

                    <Link to="/trips" className="module-card">
                        <div className="module-icon">🗺️</div>
                        <div className="module-title">Trips & Dispatch</div>
                        <div className="module-desc">Route planning, cargo weight, and status updates</div>
                    </Link>

                    <Link to="/maintenance" className="module-card">
                        <div className="module-icon">🛠️</div>
                        <div className="module-title">Maintenance Logs</div>
                        <div className="module-desc">Service schedules, center records, and repair costs</div>
                    </Link>

                    <Link to="/settings" className="module-card">
                        <div className="module-icon">⚙️</div>
                        <div className="module-title">System Settings</div>
                        <div className="module-desc">Role configurations and system preferences</div>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
