import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import DashboardPage from "../pages/DashboardPage";
import VehiclesPage from "../pages/VehiclesPage";
import Layout from "../components/Layout";
import ProtectedRoute from "./ProtectedRoute";

// Placeholder component for other module pages before subsequent phases
const ModulePlaceholder = ({ title, icon }) => (
    <div className="card glass-card p-8 text-center">
        <div className="text-4xl mb-3">{icon}</div>
        <h2 className="text-2xl font-bold mb-2">{title} Module</h2>
        <p className="text-muted mb-4">Module UI view is initialized and ready for full API integration.</p>
        <div className="inline-badge badge-primary">Backend API Connected</div>
    </div>
);

export const AppRoutes = () => {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected Routes inside Main Layout */}
            <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/vehicles" element={<VehiclesPage />} />
                    <Route path="/drivers" element={<ModulePlaceholder title="Drivers Roster" icon="👨‍✈️" />} />
                    <Route path="/customers" element={<ModulePlaceholder title="Customers Directory" icon="🏢" />} />
                    <Route path="/trips" element={<ModulePlaceholder title="Trips & Dispatch" icon="🗺️" />} />
                    <Route path="/maintenance" element={<ModulePlaceholder title="Maintenance Logs" icon="🛠️" />} />
                    <Route path="/fuel" element={<ModulePlaceholder title="Fuel Records" icon="⛽" />} />
                    <Route path="/expenses" element={<ModulePlaceholder title="Expenses Tracker" icon="💳" />} />
                    <Route path="/documents" element={<ModulePlaceholder title="Document Repository" icon="📄" />} />
                    <Route path="/notifications" element={<ModulePlaceholder title="System Notifications" icon="🔔" />} />
                    <Route path="/reports" element={<ModulePlaceholder title="Fleet Reports" icon="📈" />} />
                    <Route path="/settings" element={<ModulePlaceholder title="System Settings" icon="⚙️" />} />
                </Route>
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
};

export default AppRoutes;
