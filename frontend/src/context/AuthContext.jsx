import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initialize Auth state from localStorage on app launch
    useEffect(() => {
        try {
            const storedToken = localStorage.getItem("fleetflow_token");
            const storedUser = localStorage.getItem("fleetflow_user");

            if (storedToken && storedUser) {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            }
        } catch (error) {
            console.error("Failed to parse stored user authentication state:", error);
            localStorage.removeItem("fleetflow_token");
            localStorage.removeItem("fleetflow_user");
        } finally {
            setLoading(false);
        }
    }, []);

    // Login Action
    const login = async (email, password) => {
        try {
            const response = await api.post("/auth/login", { email, password });
            if (response.data && response.data.success) {
                const { user: userData, token: jwtToken } = response.data.data;

                setToken(jwtToken);
                setUser(userData);

                localStorage.setItem("fleetflow_token", jwtToken);
                localStorage.setItem("fleetflow_user", JSON.stringify(userData));

                return { success: true, message: response.data.message };
            } else {
                return { success: false, message: response.data.message || "Login failed" };
            }
        } catch (error) {
            const message = error.response?.data?.message || error.message || "Login failed. Please check credentials.";
            return { success: false, message };
        }
    };

    // Logout Action
    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("fleetflow_token");
        localStorage.removeItem("fleetflow_user");
    };

    // Role Helper: Check if user has specific allowed roles
    const hasRole = (...allowedRoles) => {
        if (!user || !user.role) return false;
        return allowedRoles.includes(user.role);
    };

    const value = {
        user,
        token,
        loading,
        isAuthenticated: !!token && !!user,
        login,
        logout,
        hasRole
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
