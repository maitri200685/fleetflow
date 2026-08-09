import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const ProtectedRoute = ({ allowedRoles }) => {
    const { isAuthenticated, loading, user } = useAuth();

    if (loading) {
        return (
            <div className="flex-center min-h-screen">
                <div className="spinner"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
        return (
            <div className="container p-6 text-center">
                <div className="card glass-card p-8 text-center max-w-lg mx-auto mt-12">
                    <h2 className="text-2xl font-bold text-danger mb-4">403 — Access Denied</h2>
                    <p className="text-muted mb-6">
                        Your account role (<strong>{user?.role}</strong>) does not have permission to view this page.
                    </p>
                    <a href="/dashboard" className="btn btn-primary">Return to Dashboard</a>
                </div>
            </div>
        );
    }

    return <Outlet />;
};

export default ProtectedRoute;
