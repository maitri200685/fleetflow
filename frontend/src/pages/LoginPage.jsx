import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!email || !password) {
            setError("Please enter both email and password.");
            return;
        }

        setLoading(true);
        const result = await login(email, password);
        setLoading(false);

        if (result.success) {
            navigate("/dashboard");
        } else {
            setError(result.message || "Invalid email or password.");
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card-container">
                <div className="auth-card glass-card">
                    <div className="auth-header">
                        <div className="auth-logo">🚛</div>
                        <h2>Fleet<span className="text-primary">Flow</span> System</h2>
                        <p className="auth-subtitle">Log in to your FleetFlow Management Portal</p>
                    </div>

                    {error && (
                        <div className="alert alert-danger" role="alert">
                            ⚠️ {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <input
                                id="email"
                                type="email"
                                className="form-control"
                                placeholder="name@fleetflow.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                className="form-control"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-block btn-lg mt-4"
                            disabled={loading}
                        >
                            {loading ? "Authenticating..." : "Sign In to FleetFlow"}
                        </button>
                    </form>

                    <div className="auth-footer text-center mt-6">
                        <p className="text-muted">
                            Don't have an account? <Link to="/register" className="text-primary font-semibold">Register here</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
