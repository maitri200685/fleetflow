import React, { useState, useEffect } from "react";
import api from "../services/api";

// Email Validation Regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CustomersPage = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState("add"); // "add" | "edit" | "view"
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        company_name: "",
        contact_person: "",
        phone: "",
        email: "",
        address: "",
        status: "Active"
    });
    const [formError, setFormError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Delete Modal State
    const [deletingCustomer, setDeletingCustomer] = useState(null);

    // Fetch Customers on Mount
    const fetchCustomers = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get("/customers");
            if (response.data && response.data.success) {
                setCustomers(response.data.data || []);
            } else {
                setError("Unable to load customers. Please try again.");
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Unable to load customers. Please try again.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    // Open Add Modal
    const handleOpenAddModal = () => {
        setModalMode("add");
        setFormData({
            company_name: "",
            contact_person: "",
            phone: "",
            email: "",
            address: "",
            status: "Active"
        });
        setFormError("");
        setShowModal(true);
    };

    // Open Edit Modal
    const handleOpenEditModal = (customer) => {
        setModalMode("edit");
        setSelectedCustomer(customer);
        setFormData({
            company_name: customer.company_name || "",
            contact_person: customer.contact_person || customer.contact_name || "",
            phone: customer.phone || "",
            email: customer.email || "",
            address: customer.address || "",
            status: customer.status || "Active"
        });
        setFormError("");
        setShowModal(true);
    };

    // Open View Modal
    const handleOpenViewModal = (customer) => {
        setModalMode("view");
        setSelectedCustomer(customer);
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
        if (!formData.company_name.trim()) {
            setFormError("Company Name is required.");
            return;
        }
        if (!formData.contact_person.trim()) {
            setFormError("Contact Person is required.");
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
        if (!formData.address.trim()) {
            setFormError("Address is required.");
            return;
        }

        setSubmitting(true);

        const payload = {
            company_name: formData.company_name.trim(),
            contact_person: formData.contact_person.trim(),
            contact_name: formData.contact_person.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim() || null,
            address: formData.address.trim(),
            status: formData.status
        };

        try {
            if (modalMode === "add") {
                const res = await api.post("/customers", payload);
                if (res.data && res.data.success) {
                    setSuccessMessage(`Customer ${payload.company_name} added successfully.`);
                    setShowModal(false);
                    fetchCustomers();
                    setTimeout(() => setSuccessMessage(""), 4000);
                }
            } else if (modalMode === "edit" && selectedCustomer) {
                const res = await api.put(`/customers/${selectedCustomer.id}`, payload);
                if (res.data && res.data.success) {
                    setSuccessMessage(`Customer ${payload.company_name} updated successfully.`);
                    setShowModal(false);
                    fetchCustomers();
                    setTimeout(() => setSuccessMessage(""), 4000);
                }
            }
        } catch (err) {
            const msg = err.response?.data?.message || `Failed to ${modalMode} customer.`;
            setFormError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // Confirm Delete Action
    const handleConfirmDelete = async () => {
        if (!deletingCustomer) return;

        try {
            const res = await api.delete(`/customers/${deletingCustomer.id}`);
            if (res.data && res.data.success) {
                setSuccessMessage(`Customer ${deletingCustomer.company_name || deletingCustomer.contact_person} deleted successfully.`);
                setDeletingCustomer(null);
                fetchCustomers();
                setTimeout(() => setSuccessMessage(""), 4000);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to delete customer.";
            alert(msg);
        }
    };

    // Helper: Status Badge Styling
    const getStatusBadge = (status) => {
        const s = (status || "").toLowerCase();
        if (s === "active") {
            return <span className="role-pill" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>Active</span>;
        } else {
            return <span className="role-pill" style={{ backgroundColor: "rgba(107, 114, 128, 0.15)", color: "#9ca3af" }}>Inactive</span>;
        }
    };

    return (
        <div className="customers-container">
            {/* Page Header */}
            <div className="flex-between mb-6" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h2 className="header-title" style={{ fontSize: "1.75rem", fontWeight: "700" }}>Customers</h2>
                    <p className="text-muted" style={{ fontSize: "0.9rem" }}>Manage your fleet customers and client accounts.</p>
                </div>
                <button onClick={handleOpenAddModal} className="btn btn-primary">
                    ➕ Add Customer
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
                    <button onClick={fetchCustomers} className="btn btn-sm btn-outline-danger" style={{ color: "#ffffff", borderColor: "#ffffff" }}>
                        Retry
                    </button>
                </div>
            )}

            {/* Main Content / Table */}
            <div className="card glass-card p-6">
                {loading ? (
                    <div className="p-8 text-center text-muted">
                        <div className="spinner mb-3" style={{ margin: "0 auto" }}></div>
                        <p>Loading customers...</p>
                    </div>
                ) : customers.length === 0 ? (
                    <div className="p-8 text-center" style={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px dashed #2a3447" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🏢</div>
                        <h3 className="font-semibold text-main mb-1" style={{ fontSize: "1.2rem" }}>No customers found.</h3>
                        <p className="text-muted mb-4" style={{ fontSize: "0.9rem" }}>Get started by adding your first enterprise client to FleetFlow.</p>
                        <button onClick={handleOpenAddModal} className="btn btn-primary">
                            ➕ Add Customer
                        </button>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.92rem" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid #2a3447", color: "#9ca3af" }}>
                                    <th style={{ padding: "0.85rem" }}>Company</th>
                                    <th style={{ padding: "0.85rem" }}>Contact Person</th>
                                    <th style={{ padding: "0.85rem" }}>Phone</th>
                                    <th style={{ padding: "0.85rem" }}>Email</th>
                                    <th style={{ padding: "0.85rem" }}>Address</th>
                                    <th style={{ padding: "0.85rem" }}>Status</th>
                                    <th style={{ padding: "0.85rem", textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map((c) => (
                                    <tr key={c.id} style={{ borderBottom: "1px solid #1e293b" }}>
                                        <td style={{ padding: "0.85rem", fontWeight: "600", color: "#ffffff" }}>
                                            {c.company_name || c.contact_person || c.contact_name}
                                        </td>
                                        <td style={{ padding: "0.85rem" }}>{c.contact_person || c.contact_name || "-"}</td>
                                        <td style={{ padding: "0.85rem" }}>{c.phone || "-"}</td>
                                        <td style={{ padding: "0.85rem" }}>{c.email || "-"}</td>
                                        <td style={{ padding: "0.85rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {c.address || "-"}
                                        </td>
                                        <td style={{ padding: "0.85rem" }}>{getStatusBadge(c.status)}</td>
                                        <td style={{ padding: "0.85rem", textAlign: "right" }}>
                                            <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                                                <button onClick={() => handleOpenViewModal(c)} className="btn btn-sm" style={{ background: "#1e293b", color: "#60a5fa" }}>
                                                    👁️ View
                                                </button>
                                                <button onClick={() => handleOpenEditModal(c)} className="btn btn-sm" style={{ background: "#1e293b", color: "#f59e0b" }}>
                                                    ✏️ Edit
                                                </button>
                                                <button onClick={() => setDeletingCustomer(c)} className="btn btn-sm" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                                                    🗑️ Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
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
                                {modalMode === "add" && "➕ Add New Customer"}
                                {modalMode === "edit" && "✏️ Edit Customer"}
                                {modalMode === "view" && "👁️ Customer Details"}
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

                        {modalMode === "view" && selectedCustomer ? (
                            <div style={{ fontSize: "0.95rem" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                                    <div style={{ gridColumn: "span 2" }}>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Company Name</div>
                                        <div style={{ fontWeight: "700", fontSize: "1.15rem" }}>
                                            {selectedCustomer.company_name || selectedCustomer.contact_person}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Contact Person</div>
                                        <div className="font-semibold">{selectedCustomer.contact_person || selectedCustomer.contact_name}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Account Status</div>
                                        <div>{getStatusBadge(selectedCustomer.status)}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Phone Number</div>
                                        <div className="font-semibold">{selectedCustomer.phone || "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Email Address</div>
                                        <div className="font-semibold">{selectedCustomer.email || "-"}</div>
                                    </div>
                                    <div style={{ gridColumn: "span 2" }}>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Billing Address</div>
                                        <div className="font-semibold">{selectedCustomer.address || "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Created Date</div>
                                        <div>{new Date(selectedCustomer.created_at).toLocaleDateString()}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Updated Date</div>
                                        <div>{selectedCustomer.updated_at ? new Date(selectedCustomer.updated_at).toLocaleDateString() : "-"}</div>
                                    </div>
                                </div>
                                <div style={{ marginTop: "1.5rem", textAlign: "right" }}>
                                    <button onClick={() => setShowModal(false)} className="btn btn-primary">
                                        Close Details
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleFormSubmit}>
                                <div className="form-group">
                                    <label htmlFor="company_name">Company Name *</label>
                                    <input
                                        id="company_name"
                                        name="company_name"
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. ABC Logistics Pvt. Ltd."
                                        value={formData.company_name}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="contact_person">Contact Person *</label>
                                    <input
                                        id="contact_person"
                                        name="contact_person"
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Vikram Sharma"
                                        value={formData.contact_person}
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
                                            placeholder="contact@abclogistics.com"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="address">Address *</label>
                                    <textarea
                                        id="address"
                                        name="address"
                                        className="form-control"
                                        rows="2"
                                        placeholder="e.g. Plot 42, Transport Nagar, Sector 18"
                                        value={formData.address}
                                        onChange={handleInputChange}
                                        required
                                    ></textarea>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="status">Account Status *</label>
                                    <select
                                        id="status"
                                        name="status"
                                        className="form-control"
                                        value={formData.status}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>

                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ background: "#1e293b", color: "#ffffff" }}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? "Saving..." : (modalMode === "add" ? "Save Customer" : "Update Customer")}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {deletingCustomer && (
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
                        <h3 className="card-title mb-2">Delete Customer?</h3>
                        <p className="text-muted mb-6" style={{ fontSize: "0.95rem" }}>
                            Are you sure you want to delete customer <strong>{deletingCustomer.company_name || deletingCustomer.contact_person}</strong>?
                        </p>
                        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                            <button onClick={() => setDeletingCustomer(null)} className="btn" style={{ background: "#1e293b", color: "#ffffff" }}>
                                Cancel
                            </button>
                            <button onClick={handleConfirmDelete} className="btn" style={{ background: "#ef4444", color: "#ffffff" }}>
                                Delete Customer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomersPage;
