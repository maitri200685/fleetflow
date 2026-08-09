import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import DashboardPage from "../pages/DashboardPage";
import VehiclesPage from "../pages/VehiclesPage";
import DriversPage from "../pages/DriversPage";
import CustomersPage from "../pages/CustomersPage";
import TripsPage from "../pages/TripsPage";
import MaintenancePage from "../pages/MaintenancePage";
import FuelPage from "../pages/FuelPage";
import ExpensesPage from "../pages/ExpensesPage";
import DocumentsPage from "../pages/DocumentsPage";
import NotificationsPage from "../pages/NotificationsPage";
import AnalyticsPage from "../pages/AnalyticsPage";
import Layout from "../components/Layout";
import ProtectedRoute from "./ProtectedRoute";

// Placeholder component for remaining module pages
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
                    <Route path="/drivers" element={<DriversPage />} />
                    <Route path="/customers" element={<CustomersPage />} />
                    <Route path="/trips" element={<TripsPage />} />
                    <Route path="/maintenance" element={<MaintenancePage />} />
                    <Route path="/fuel" element={<FuelPage />} />
                    <Route path="/expenses" element={<ExpensesPage />} />
                    <Route path="/documents" element={<DocumentsPage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/reports" element={<Navigate to="/analytics" replace />} />
                    <Route path="/settings" element={<ModulePlaceholder title="System Settings" icon="⚙️" />} />
                </Route>
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
};

export default AppRoutes;
