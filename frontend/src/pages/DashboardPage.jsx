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
        completedTrips: 0
    });
    const [recentTrips, setRecentTrips] = useState([]);

    useEffect(() => {
        let isMounted = true;

        const fetchDashboardData = async () => {
            try {
                // Fetch Vehicles
                let vCount = 0;
                let vAvailable = 0;
                try {
                    const vRes = await api.get("/vehicles");
                    if (vRes.data && vRes.data.data) {
                        vCount = vRes.data.count || vRes.data.data.length || 0;
                        vAvailable = vRes.data.data.filter(
                            (v) => (v.status || "").toUpperCase() === "AVAILABLE"
                        ).length;
                    }
                } catch {
                    // Fallback to 0 if endpoint returns empty or unauthorized
                }

                // Fetch Drivers
                let dCount = 0;
                try {
                    const dRes = await api.get("/drivers");
                    if (dRes.data && dRes.data.data) {
                        dCount = dRes.data.count || dRes.data.data.length || 0;
                    }
                } catch {
                    // Fallback to 0
                }

                // Fetch Trips
                let tActive = 0;
                let tCompleted = 0;
                let tripsList = [];
                try {
                    const tRes = await api.get("/trips");
                    if (tRes.data && tRes.data.data) {
                        tripsList = tRes.data.data;
                        tActive = tripsList.filter(
                            (t) => t.status === "In Transit" || t.status === "Assigned"
                        ).length;
                        tCompleted = tripsList.filter(
                            (t) => t.status === "Completed"
                        ).length;
                    }
                } catch {
                    // Fallback to 0
                }

                if (isMounted) {
                    setStats({
                        totalVehicles: vCount,
                        availableVehicles: vAvailable,
                        totalDrivers: dCount,
                        activeTrips: tActive,
                        completedTrips: tCompleted
                    });
                    setRecentTrips(tripsList.slice(0, 5));
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
                                        <td style={{ padding: "0.75rem", fontWeight: "600" }}>{t.trip_code}</td>
                                        <td style={{ padding: "0.75rem" }}>{t.origin}</td>
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

                    <Link to="/reports" className="module-card">
                        <div className="module-icon">📈</div>
                        <div className="module-title">Fleet Reports</div>
                        <div className="module-desc">Analytics, mileage reports, and fuel efficiency</div>
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
