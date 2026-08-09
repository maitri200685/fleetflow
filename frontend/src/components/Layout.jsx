import React, { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const Layout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    // Format role label cleanly (e.g. FLEET_MANAGER -> Fleet Manager)
    const formatRole = (role) => {
        if (!role) return "User";
        return role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    };

    return (
        <div className="app-layout">
            {/* Overlay for mobile sidebar */}
            {sidebarOpen && (
                <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
            )}

            {/* Sidebar Navigation */}
            <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
                <div className="sidebar-header">
                    <Link to="/dashboard" className="brand-logo">
                        <span className="brand-icon">🚛</span>
                        <span className="brand-name">Fleet<span className="text-primary">Flow</span></span>
                    </Link>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section-label">MAIN MENU</div>
                    <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} onClick={() => setSidebarOpen(false)}>
                        <span className="nav-icon">📊</span>
                        <span>Dashboard</span>
                    </NavLink>
                    <NavLink to="/vehicles" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} onClick={() => setSidebarOpen(false)}>
                        <span className="nav-icon">🚛</span>
                        <span>Vehicles</span>
                    </NavLink>
                    <NavLink to="/drivers" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} onClick={() => setSidebarOpen(false)}>
                        <span className="nav-icon">👨‍✈️</span>
                        <span>Drivers</span>
                    </NavLink>
                    <NavLink to="/trips" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} onClick={() => setSidebarOpen(false)}>
                        <span className="nav-icon">🗺️</span>
                        <span>Trips</span>
                    </NavLink>
                    <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} onClick={() => setSidebarOpen(false)}>
                        <span className="nav-icon">📈</span>
                        <span>Reports</span>
                    </NavLink>
                    <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} onClick={() => setSidebarOpen(false)}>
                        <span className="nav-icon">⚙️</span>
                        <span>Settings</span>
                    </NavLink>

                    <div className="nav-section-label mt-4">OPERATIONS</div>
                    <NavLink to="/customers" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} onClick={() => setSidebarOpen(false)}>
                        <span className="nav-icon">🏢</span>
                        <span>Customers</span>
                    </NavLink>
                    <NavLink to="/maintenance" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} onClick={() => setSidebarOpen(false)}>
                        <span className="nav-icon">🛠️</span>
                        <span>Maintenance</span>
                    </NavLink>
                    <NavLink to="/fuel" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} onClick={() => setSidebarOpen(false)}>
                        <span className="nav-icon">⛽</span>
                        <span>Fuel Logs</span>
                    </NavLink>
                    <NavLink to="/expenses" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} onClick={() => setSidebarOpen(false)}>
                        <span className="nav-icon">💳</span>
                        <span>Expenses</span>
                    </NavLink>
                    <NavLink to="/documents" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} onClick={() => setSidebarOpen(false)}>
                        <span className="nav-icon">📄</span>
                        <span>Documents</span>
                    </NavLink>
                    <NavLink to="/notifications" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`} onClick={() => setSidebarOpen(false)}>
                        <span className="nav-icon">🔔</span>
                        <span>Notifications</span>
                    </NavLink>
                </nav>

                <div className="sidebar-footer">
                    <div className="user-mini-profile">
                        <div className="avatar">{user?.name ? user.name.charAt(0).toUpperCase() : "U"}</div>
                        <div className="user-info overflow-hidden">
                            <div className="user-name truncate">{user?.name || "Fleet User"}</div>
                            <div className="user-role-badge badge-role">{formatRole(user?.role)}</div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Wrapper */}
            <div className="main-wrapper">
                {/* Header Navbar */}
                <header className="top-header">
                    <div className="header-left">
                        <button className="mobile-toggle-btn" onClick={toggleSidebar} aria-label="Toggle Navigation">
                            ☰
                        </button>
                        <h1 className="header-title">Fleet Management Console</h1>
                    </div>

                    <div className="header-right">
                        <div className="user-profile-menu">
                            <span className="greeting-text">Welcome, <strong>{user?.name}</strong></span>
                            <span className="role-pill">{user?.role}</span>
                            <button onClick={handleLogout} className="btn btn-outline-danger btn-sm">
                                🚪 Logout
                            </button>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="main-content">
                    <Outlet />
                </main>

                {/* Footer */}
                <footer className="app-footer">
                    <p>© 2026 FleetFlow Enterprise Fleet Management System. All rights reserved.</p>
                </footer>
            </div>
        </div>
    );
};

export default Layout;
