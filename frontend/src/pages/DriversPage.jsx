import React, { useState, useEffect } from "react";
import api from "../services/api";

// Email Validation Regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Helper: Calculate License Expiry State (Valid, Expiring Soon, Expired)
const getLicenseExpiryInfo = (expiryDateStr) => {
    if (!expiryDateStr) return { label: "Unknown", color: "#9ca3af", bg: "rgba(107, 114, 128, 0.15)" };
    
    const expiry = new Date(expiryDateStr);
    const now = new Date();
    // Normalize to midnight
    expiry.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { label: "Expired", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)", days: Math.abs(diffDays) };
    } else if (diffDays <= 30) {
        return { label: "Expiring Soon", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", days: diffDays };
    } else {
        return { label: "Valid", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)", days: diffDays };
    }
};

export const DriversPage = () => {
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState("add"); // "add" | "edit" | "view"
    const [selectedDriver, setSelectedDriver] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        license_number: "",
        license_expiry: "",
        status: "Available"
    });
    const [formError, setFormError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Delete Modal State
    const [deletingDriver, setDeletingDriver] = useState(null);

    // Fetch Drivers on Mount
    const fetchDrivers = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get("/drivers");
            if (response.data && response.data.success) {
                setDrivers(response.data.data || []);
            } else {
                setError("Unable to load drivers. Please try again.");
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Unable to load drivers. Please try again.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDrivers();
    }, []);

    // Open Add Modal
    const handleOpenAddModal = () => {
        setModalMode("add");
        // Default expiry to 1 year from today
        const defaultExpiry = new Date();
        defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);
        
        setFormData({
            name: "",
            phone: "",
            email: "",
            license_number: "",
            license_expiry: defaultExpiry.toISOString().split("T")[0],
            status: "Available"
        });
        setFormError("");
        setShowModal(true);
    };

    // Open Edit Modal
    const handleOpenEditModal = (driver) => {
        setModalMode("edit");
        setSelectedDriver(driver);

        let expiryFormatted = "";
        if (driver.license_expiry) {
            expiryFormatted = new Date(driver.license_expiry).toISOString().split("T")[0];
        }

        setFormData({
            name: driver.name || driver.full_name || "",
            phone: driver.phone || "",
            email: driver.email || "",
            license_number: driver.license_number || "",
            license_expiry: expiryFormatted,
            status: driver.status || "Available"
        });
        setFormError("");
        setShowModal(true);
    };

    // Open View Modal
    const handleOpenViewModal = (driver) => {
        setModalMode("view");
        setSelectedDriver(driver);
        setShowModal(true);
    };

    // Form Input Change Handler
    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    // Submit Add / Edit Form
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setFormError("");

        // Pre-submit Client Validation
        if (!formData.name.trim()) {
            setFormError("Driver Name is required.");
            return;
        }
        if (!formData.phone.trim() || formData.phone.trim().length < 7) {
            setFormError("Valid Phone Number is required.");
            return;
        }
        if (formData.email.trim() && !EMAIL_REGEX.test(formData.email.trim())) {
            setFormError("Please enter a valid email address.");
            return;
        }
        if (!formData.license_number.trim()) {
            setFormError("License Number is required.");
            return;
        }
        if (!formData.license_expiry) {
            setFormError("License Expiry date is required.");
            return;
        }

        setSubmitting(true);

        const payload = {
            name: formData.name.trim(),
            full_name: formData.name.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim() || null,
            license_number: formData.license_number.trim(),
            license_expiry: formData.license_expiry,
            status: formData.status
        };

        try {
            if (modalMode === "add") {
                const res = await api.post("/drivers", payload);
                if (res.data && res.data.success) {
                    setSuccessMessage(`Driver ${payload.name} added successfully.`);
                    setShowModal(false);
                    fetchDrivers();
                    setTimeout(() => setSuccessMessage(""), 4000);
                }
            } else if (modalMode === "edit" && selectedDriver) {
                const res = await api.put(`/drivers/${selectedDriver.id}`, payload);
                if (res.data && res.data.success) {
                    setSuccessMessage(`Driver ${payload.name} updated successfully.`);
                    setShowModal(false);
                    fetchDrivers();
                    setTimeout(() => setSuccessMessage(""), 4000);
                }
            }
        } catch (err) {
            const msg = err.response?.data?.message || `Failed to ${modalMode} driver.`;
            setFormError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // Confirm Delete Action
    const handleConfirmDelete = async () => {
        if (!deletingDriver) return;

        try {
            const res = await api.delete(`/drivers/${deletingDriver.id}`);
            if (res.data && res.data.success) {
                setSuccessMessage(`Driver ${deletingDriver.name || deletingDriver.full_name} deleted successfully.`);
                setDeletingDriver(null);
                fetchDrivers();
                setTimeout(() => setSuccessMessage(""), 4000);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to delete driver.";
            alert(msg);
        }
    };

    // Helper: Status Badge Styling
    const getStatusBadge = (status) => {
        const s = (status || "").toLowerCase();
        if (s === "available") {
            return <span className="role-pill" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>Available</span>;
        } else if (s === "on trip" || s === "on_trip" || s === "on duty" || s === "on_delivery") {
            return <span className="role-pill" style={{ backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>On Trip</span>;
        } else {
            return <span className="role-pill" style={{ backgroundColor: "rgba(107, 114, 128, 0.15)", color: "#9ca3af" }}>Inactive</span>;
        }
    };

    return (
        <div className="drivers-container">
            {/* Page Header */}
            <div className="flex-between mb-6" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h2 className="header-title" style={{ fontSize: "1.75rem", fontWeight: "700" }}>Drivers</h2>
                    <p className="text-muted" style={{ fontSize: "0.9rem" }}>Manage and monitor fleet drivers.</p>
                </div>
                <button onClick={handleOpenAddModal} className="btn btn-primary">
                    ➕ Add Driver
                </button>
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
                    <button onClick={fetchDrivers} className="btn btn-sm btn-outline-danger" style={{ color: "#ffffff", borderColor: "#ffffff" }}>
                        Retry
                    </button>
                </div>
            )}

            {/* Main Content / Table */}
            <div className="card glass-card p-6">
                {loading ? (
                    <div className="p-8 text-center text-muted">
                        <div className="spinner mb-3" style={{ margin: "0 auto" }}></div>
                        <p>Loading drivers...</p>
                    </div>
                ) : drivers.length === 0 ? (
                    <div className="p-8 text-center" style={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px dashed #2a3447" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>👨‍✈️</div>
                        <h3 className="font-semibold text-main mb-1" style={{ fontSize: "1.2rem" }}>No drivers found.</h3>
                        <p className="text-muted mb-4" style={{ fontSize: "0.9rem" }}>Get started by adding your first driver to the FleetFlow driver roster.</p>
                        <button onClick={handleOpenAddModal} className="btn btn-primary">
                            ➕ Add Driver
                        </button>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.92rem" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid #2a3447", color: "#9ca3af" }}>
                                    <th style={{ padding: "0.85rem" }}>Name</th>
                                    <th style={{ padding: "0.85rem" }}>Phone</th>
                                    <th style={{ padding: "0.85rem" }}>Email</th>
                                    <th style={{ padding: "0.85rem" }}>License Number</th>
                                    <th style={{ padding: "0.85rem" }}>License Expiry</th>
                                    <th style={{ padding: "0.85rem" }}>Status</th>
                                    <th style={{ padding: "0.85rem", textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {drivers.map((d) => {
                                    const expiryInfo = getLicenseExpiryInfo(d.license_expiry);
                                    const formattedDate = d.license_expiry ? new Date(d.license_expiry).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

                                    return (
                                        <tr key={d.id} style={{ borderBottom: "1px solid #1e293b" }}>
                                            <td style={{ padding: "0.85rem", fontWeight: "600", color: "#ffffff" }}>
                                                {d.name || d.full_name}
                                            </td>
                                            <td style={{ padding: "0.85rem" }}>{d.phone || "-"}</td>
                                            <td style={{ padding: "0.85rem" }}>{d.email || "-"}</td>
                                            <td style={{ padding: "0.85rem", fontFamily: "monospace" }}>{d.license_number}</td>
                                            <td style={{ padding: "0.85rem" }}>
                                                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                                                    <span>{formattedDate}</span>
                                                    <span style={{
                                                        display: "inline-block",
                                                        padding: "0.15rem 0.5rem",
                                                        borderRadius: "10px",
                                                        fontSize: "0.72rem",
                                                        fontWeight: "600",
                                                        width: "fit-content",
                                                        backgroundColor: expiryInfo.bg,
                                                        color: expiryInfo.color
                                                    }}>
                                                        {expiryInfo.label}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ padding: "0.85rem" }}>{getStatusBadge(d.status)}</td>
                                            <td style={{ padding: "0.85rem", textAlign: "right" }}>
                                                <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                                                    <button onClick={() => handleOpenViewModal(d)} className="btn btn-sm" style={{ background: "#1e293b", color: "#60a5fa" }}>
                                                        👁️ View
                                                    </button>
                                                    <button onClick={() => handleOpenEditModal(d)} className="btn btn-sm" style={{ background: "#1e293b", color: "#f59e0b" }}>
                                                        ✏️ Edit
                                                    </button>
                                                    <button onClick={() => setDeletingDriver(d)} className="btn btn-sm" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                                                        🗑️ Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Dialog for Add / Edit / View */}
            {showModal && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.75)",
                    backdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 200,
                    padding: "1rem"
                }}>
                    <div className="card glass-card" style={{ width: "100%", maxWidth: "520px", padding: "2rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                            <h3 className="card-title">
                                {modalMode === "add" && "➕ Add New Driver"}
                                {modalMode === "edit" && "✏️ Edit Driver"}
                                {modalMode === "view" && "👁️ Driver Details"}
                            </h3>
                            <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "1.5rem", cursor: "pointer" }}>
                                ✕
                            </button>
                        </div>

                        {formError && (
                            <div className="alert alert-danger" role="alert">
                                ⚠️ {formError}
                            </div>
                        )}

                        {modalMode === "view" && selectedDriver ? (
                            <div style={{ fontSize: "0.95rem" }}>
                                {(() => {
                                    const expInfo = getLicenseExpiryInfo(selectedDriver.license_expiry);
                                    const expDateFmt = selectedDriver.license_expiry ? new Date(selectedDriver.license_expiry).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

                                    return (
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                                            <div>
                                                <div className="text-muted" style={{ fontSize: "0.8rem" }}>Driver Name</div>
                                                <div style={{ fontWeight: "700", fontSize: "1.1rem" }}>
                                                    {selectedDriver.name || selectedDriver.full_name}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-muted" style={{ fontSize: "0.8rem" }}>Driver Status</div>
                                                <div>{getStatusBadge(selectedDriver.status)}</div>
                                            </div>
                                            <div>
                                                <div className="text-muted" style={{ fontSize: "0.8rem" }}>Phone Number</div>
                                                <div className="font-semibold">{selectedDriver.phone || "-"}</div>
                                            </div>
                                            <div>
                                                <div className="text-muted" style={{ fontSize: "0.8rem" }}>Email Address</div>
                                                <div className="font-semibold">{selectedDriver.email || "-"}</div>
                                            </div>
                                            <div>
                                                <div className="text-muted" style={{ fontSize: "0.8rem" }}>License Number</div>
                                                <div className="font-semibold" style={{ fontFamily: "monospace" }}>{selectedDriver.license_number}</div>
                                            </div>
                                            <div>
                                                <div className="text-muted" style={{ fontSize: "0.8rem" }}>License Expiry Date</div>
                                                <div className="font-semibold">{expDateFmt}</div>
                                            </div>
                                            <div style={{ gridColumn: "span 2" }}>
                                                <div className="text-muted" style={{ fontSize: "0.8rem" }}>License Expiry Status</div>
                                                <div style={{ marginTop: "0.2rem" }}>
                                                    <span style={{
                                                        display: "inline-block",
                                                        padding: "0.3rem 0.85rem",
                                                        borderRadius: "12px",
                                                        fontSize: "0.85rem",
                                                        fontWeight: "600",
                                                        backgroundColor: expInfo.bg,
                                                        color: expInfo.color
                                                    }}>
                                                        {expInfo.label}
                                                    </span>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-muted" style={{ fontSize: "0.8rem" }}>Created Date</div>
                                                <div>{new Date(selectedDriver.created_at).toLocaleDateString()}</div>
                                            </div>
                                            <div>
                                                <div className="text-muted" style={{ fontSize: "0.8rem" }}>Updated Date</div>
                                                <div>{selectedDriver.updated_at ? new Date(selectedDriver.updated_at).toLocaleDateString() : "-"}</div>
                                            </div>
                                        </div>
                                    );
                                })()}
                                <div style={{ marginTop: "1.5rem", textAlign: "right" }}>
                                    <button onClick={() => setShowModal(false)} className="btn btn-primary">
                                        Close Details
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleFormSubmit}>
                                <div className="form-group">
                                    <label htmlFor="name">Full Name *</label>
                                    <input
                                        id="name"
                                        name="name"
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Rahul Patel"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="phone">Phone Number *</label>
                                        <input
                                            id="phone"
                                            name="phone"
                                            type="tel"
                                            className="form-control"
                                            placeholder="e.g. +91 98765 43210"
                                            value={formData.phone}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="email">Email Address</label>
                                        <input
                                            id="email"
                                            name="email"
                                            type="email"
                                            className="form-control"
                                            placeholder="rahul@fleetflow.com"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="license_number">License Number *</label>
                                        <input
                                            id="license_number"
                                            name="license_number"
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. DL-1420110012345"
                                            value={formData.license_number}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="license_expiry">License Expiry Date *</label>
                                        <input
                                            id="license_expiry"
                                            name="license_expiry"
                                            type="date"
                                            className="form-control"
                                            value={formData.license_expiry}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="status">Driver Status *</label>
                                    <select
                                        id="status"
                                        name="status"
                                        className="form-control"
                                        value={formData.status}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        <option value="Available">Available</option>
                                        <option value="On Trip">On Trip</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>

                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ background: "#1e293b", color: "#ffffff" }}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? "Saving..." : (modalMode === "add" ? "Save Driver" : "Update Driver")}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {deletingDriver && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.75)",
                    backdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 210,
                    padding: "1rem"
                }}>
                    <div className="card glass-card" style={{ width: "100%", maxWidth: "440px", padding: "2rem", textAlign: "center" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>⚠️</div>
                        <h3 className="card-title mb-2">Delete Driver?</h3>
                        <p className="text-muted mb-6" style={{ fontSize: "0.95rem" }}>
                            Are you sure you want to delete driver <strong>{deletingDriver.name || deletingDriver.full_name}</strong>?
                        </p>
                        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                            <button onClick={() => setDeletingDriver(null)} className="btn" style={{ background: "#1e293b", color: "#ffffff" }}>
                                Cancel
                            </button>
                            <button onClick={handleConfirmDelete} className="btn" style={{ background: "#ef4444", color: "#ffffff" }}>
                                Delete Driver
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DriversPage;
