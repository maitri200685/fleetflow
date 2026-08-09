import React, { useState, useEffect } from "react";
import api from "../services/api";

export const NotificationsPage = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Filter States
    const [filterTab, setFilterTab] = useState("all"); // "all" | "unread" | "critical" | "warning" | "info" | "success"
    const [syncing, setSyncing] = useState(false);

    // Fetch Notifications
    const fetchNotifications = async () => {
        setLoading(true);
        setError("");
        try {
            let queryParams = [];
            if (filterTab === "unread") queryParams.push("unread=true");
            else if (filterTab === "critical") queryParams.push("severity=critical");
            else if (filterTab === "warning") queryParams.push("severity=warning");
            else if (filterTab === "info") queryParams.push("severity=info");
            else if (filterTab === "success") queryParams.push("severity=success");

            const queryString = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";
            const res = await api.get(`/notifications${queryString}`);

            if (res.data && res.data.success) {
                setNotifications(res.data.data || []);
            } else {
                setError("Unable to load notifications. Please try again.");
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Unable to load notifications. Please try again.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, [filterTab]);

    // Trigger Fleet Auto-Sync
    const handleSyncAlerts = async () => {
        setSyncing(true);
        try {
            const res = await api.post("/notifications/generate");
            if (res.data && res.data.success) {
                setNotifications(res.data.data || []);
                setSuccessMessage("Fleet data scanned and notifications synchronized.");
                setTimeout(() => setSuccessMessage(""), 4000);
            }
        } catch (err) {
            alert("Failed to sync fleet notifications.");
        } finally {
            setSyncing(false);
        }
    };

    // Mark Single Notification as Read
    const handleMarkAsRead = async (id) => {
        try {
            const res = await api.put(`/notifications/${id}/read`);
            if (res.data && res.data.success) {
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            }
        } catch (err) {
            alert("Failed to mark notification as read.");
        }
    };

    // Mark All as Read
    const handleMarkAllAsRead = async () => {
        try {
            const res = await api.put("/notifications/read-all");
            if (res.data && res.data.success) {
                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
                setSuccessMessage("All notifications marked as read.");
                setTimeout(() => setSuccessMessage(""), 4000);
            }
        } catch (err) {
            alert("Failed to mark all as read.");
        }
    };

    // Delete Notification
    const handleDeleteNotification = async (id) => {
        try {
            const res = await api.delete(`/notifications/${id}`);
            if (res.data && res.data.success) {
                setNotifications(prev => prev.filter(n => n.id !== id));
            }
        } catch (err) {
            alert("Failed to delete notification.");
        }
    };

    // Severity Badge Helper
    const getSeverityBadge = (severity) => {
        const s = (severity || "info").toLowerCase();
        let bg = "rgba(59, 130, 246, 0.15)";
        let color = "#3b82f6";
        let icon = "ℹ️";

        if (s === "critical") {
            bg = "rgba(239, 68, 68, 0.15)";
            color = "#ef4444";
            icon = "🚨";
        } else if (s === "warning") {
            bg = "rgba(245, 158, 11, 0.15)";
            color = "#f59e0b";
            icon = "⚠️";
        } else if (s === "success") {
            bg = "rgba(16, 185, 129, 0.15)";
            color = "#10b981";
            icon = "✅";
        }

        return (
            <span className="role-pill" style={{ backgroundColor: bg, color: color, fontWeight: "600", textTransform: "capitalize" }}>
                {icon} {s}
            </span>
        );
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div className="notifications-container">
            {/* Page Header */}
            <div className="flex-between mb-6" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h2 className="header-title" style={{ fontSize: "1.75rem", fontWeight: "700" }}>
                        Notifications & Alerting
                    </h2>
                    <p className="text-muted" style={{ fontSize: "0.9rem" }}>Operational fleet warnings, document expiries, maintenance alerts, and trip updates.</p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button onClick={handleSyncAlerts} className="btn btn-outline" style={{ background: "#1e293b", color: "#60a5fa" }} disabled={syncing}>
                        🔄 {syncing ? "Scanning Fleet..." : "Sync Fleet Alerts"}
                    </button>
                    <button onClick={handleMarkAllAsRead} className="btn btn-primary" disabled={unreadCount === 0}>
                        ✓ Mark All as Read
                    </button>
                </div>
            </div>

            {/* Success Alert Banner */}
            {successMessage && (
                <div className="alert alert-success" role="alert">
                    ✅ {successMessage}
                </div>
            )}

            {/* Error Banner */}
            {error && (
                <div className="alert alert-danger" role="alert" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>⚠️ {error}</span>
                    <button onClick={fetchNotifications} className="btn btn-sm btn-outline-danger" style={{ color: "#ffffff", borderColor: "#ffffff" }}>
                        Retry
                    </button>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="mb-6" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", borderBottom: "1px solid #1e293b", paddingBottom: "0.75rem" }}>
                <button
                    onClick={() => setFilterTab("all")}
                    className={`btn btn-sm ${filterTab === "all" ? "btn-primary" : ""}`}
                    style={{ background: filterTab === "all" ? "#3b82f6" : "#0f172a", color: "#ffffff" }}
                >
                    All Notifications ({notifications.length})
                </button>
                <button
                    onClick={() => setFilterTab("unread")}
                    className={`btn btn-sm ${filterTab === "unread" ? "btn-primary" : ""}`}
                    style={{ background: filterTab === "unread" ? "#3b82f6" : "#0f172a", color: "#ffffff" }}
                >
                    Unread ({unreadCount})
                </button>
                <button
                    onClick={() => setFilterTab("critical")}
                    className={`btn btn-sm`}
                    style={{ background: filterTab === "critical" ? "rgba(239, 68, 68, 0.2)" : "#0f172a", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)" }}
                >
                    🚨 Critical
                </button>
                <button
                    onClick={() => setFilterTab("warning")}
                    className={`btn btn-sm`}
                    style={{ background: filterTab === "warning" ? "rgba(245, 158, 11, 0.2)" : "#0f172a", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)" }}
                >
                    ⚠️ Warning
                </button>
                <button
                    onClick={() => setFilterTab("info")}
                    className={`btn btn-sm`}
                    style={{ background: filterTab === "info" ? "rgba(59, 130, 246, 0.2)" : "#0f172a", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.3)" }}
                >
                    ℹ️ Info
                </button>
            </div>

            {/* Notification List Container */}
            <div className="card glass-card p-6">
                {loading ? (
                    <div className="p-8 text-center text-muted">
                        <div className="spinner mb-3" style={{ margin: "0 auto" }}></div>
                        <p>Loading fleet notifications...</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="p-8 text-center" style={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px dashed #2a3447" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🔔</div>
                        <h3 className="font-semibold text-main mb-1" style={{ fontSize: "1.2rem" }}>No notifications found.</h3>
                        <p className="text-muted mb-4" style={{ fontSize: "0.9rem" }}>Your fleet operational alerts and system warnings will appear here.</p>
                        <button onClick={handleSyncAlerts} className="btn btn-primary">
                            🔄 Sync Fleet Data
                        </button>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {notifications.map((n) => {
                            const createdAtFmt = n.created_at ? new Date(n.created_at).toLocaleString("en-GB", {
                                day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                            }) : "-";

                            return (
                                <div
                                    key={n.id}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "flex-start",
                                        padding: "1.2rem",
                                        borderRadius: "8px",
                                        backgroundColor: n.is_read ? "#0f172a" : "rgba(30, 41, 59, 0.7)",
                                        borderLeft: n.is_read ? "4px solid #334155" : (n.severity === "critical" ? "4px solid #ef4444" : n.severity === "warning" ? "4px solid #f59e0b" : "4px solid #3b82f6"),
                                        borderTop: "1px solid #1e293b",
                                        borderRight: "1px solid #1e293b",
                                        borderBottom: "1px solid #1e293b",
                                        transition: "all 0.2s ease"
                                    }}
                                >
                                    <div style={{ flex: 1, paddingRight: "1rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.35rem" }}>
                                            {getSeverityBadge(n.severity)}
                                            <span style={{ fontSize: "0.8rem", color: "#9ca3af", fontFamily: "monospace" }}>
                                                {n.type || n.notification_type}
                                            </span>
                                            {!n.is_read && (
                                                <span className="role-pill" style={{ backgroundColor: "#3b82f6", color: "#ffffff", fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}>
                                                    NEW
                                                </span>
                                            )}
                                        </div>

                                        <h4 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#ffffff", marginBottom: "0.3rem" }}>
                                            {n.title}
                                        </h4>
                                        <p style={{ fontSize: "0.92rem", color: "#cbd5e1", margin: 0, lineHeight: 1.5 }}>
                                            {n.message}
                                        </p>
                                        <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.5rem" }}>
                                            🕒 {createdAtFmt}
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                        {!n.is_read && (
                                            <button onClick={() => handleMarkAsRead(n.id)} className="btn btn-sm" style={{ background: "#1e293b", color: "#10b981" }}>
                                                ✓ Mark Read
                                            </button>
                                        )}
                                        <button onClick={() => handleDeleteNotification(n.id)} className="btn btn-sm" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsPage;
