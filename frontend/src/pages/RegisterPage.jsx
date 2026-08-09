import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

export const RegisterPage = () => {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        phone: "",
        role: "FLEET_MANAGER"
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMessage("");

        if (!formData.name || !formData.email || !formData.password || !formData.role) {
            setError("Name, email, password, and role are required.");
            return;
        }

        setLoading(true);
        try {
            const response = await api.post("/auth/register", formData);
            if (response.data && response.data.success) {
                setSuccessMessage("Account registered successfully! Redirecting to login...");
                setTimeout(() => {
                    navigate("/login");
                }, 1500);
            } else {
                setError(response.data.message || "Registration failed.");
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || "Failed to register account.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card-container">
                <div className="auth-card glass-card">
                    <div className="auth-header">
                        <div className="auth-logo">🚛</div>
                        <h2>Create Fleet<span className="text-primary">Flow</span> Account</h2>
                        <p className="auth-subtitle">Register user for fleet system access</p>
                    </div>

                    {error && (
                        <div className="alert alert-danger" role="alert">
                            ⚠️ {error}
                        </div>
                    )}

                    {successMessage && (
                        <div className="alert alert-success" role="alert">
                            ✅ {successMessage}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label htmlFor="name">Full Name</label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                className="form-control"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                className="form-control"
                                placeholder="john@fleetflow.com"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group col">
                                <label htmlFor="password">Password</label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    className="form-control"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group col">
                                <label htmlFor="phone">Phone Number</label>
                                <input
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    className="form-control"
                                    placeholder="9876543210"
                                    value={formData.phone}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="role">Assign System Role</label>
                            <select
                                id="role"
                                name="role"
                                className="form-control"
                                value={formData.role}
                                onChange={handleChange}
                                required
                            >
                                <option value="ADMIN">System Administrator (ADMIN)</option>
                                <option value="FLEET_MANAGER">Fleet Manager (FLEET_MANAGER)</option>
                                <option value="DRIVER">Fleet Driver (DRIVER)</option>
                                <option value="MAINTENANCE_STAFF">Maintenance Technician (MAINTENANCE_STAFF)</option>
                                <option value="CUSTOMER">Client / Customer (CUSTOMER)</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-block btn-lg mt-4"
                            disabled={loading}
                        >
                            {loading ? "Creating Account..." : "Register User Account"}
                        </button>
                    </form>

                    <div className="auth-footer text-center mt-6">
                        <p className="text-muted">
                            Already have an account? <Link to="/login" className="text-primary font-semibold">Log in here</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
