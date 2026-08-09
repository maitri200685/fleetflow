import React, { useState, useEffect } from "react";
import api from "../services/api";

const CATEGORY_OPTIONS = [
    "Fuel",
    "Maintenance",
    "Toll",
    "Parking",
    "Insurance",
    "Permit",
    "Repair",
    "Driver Expense",
    "Driver Allowance",
    "Other"
];

export const ExpensesPage = () => {
    const [expenses, setExpenses] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [trips, setTrips] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [summary, setSummary] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Filter States
    const [filterCategory, setFilterCategory] = useState("");
    const [filterVehicle, setFilterVehicle] = useState("");
    const [filterTrip, setFilterTrip] = useState("");
    const [filterStartDate, setFilterStartDate] = useState("");
    const [filterEndDate, setFilterEndDate] = useState("");

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState("add"); // "add" | "edit" | "view"
    const [selectedExpense, setSelectedExpense] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        expense_number: "",
        expense_date: "",
        category: "Toll",
        amount: "",
        description: "",
        vendor: "",
        reference_number: "",
        vehicle_id: "",
        trip_id: "",
        driver_id: "",
        notes: ""
    });
    const [formError, setFormError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Delete Modal State
    const [deletingExpense, setDeletingExpense] = useState(null);

    // Fetch Expenses & Summaries
    const fetchData = async () => {
        setLoading(true);
        setError("");
        try {
            let queryParams = [];
            if (filterCategory) queryParams.push(`category=${encodeURIComponent(filterCategory)}`);
            if (filterVehicle) queryParams.push(`vehicle_id=${filterVehicle}`);
            if (filterTrip) queryParams.push(`trip_id=${filterTrip}`);
            if (filterStartDate) queryParams.push(`start_date=${filterStartDate}`);
            if (filterEndDate) queryParams.push(`end_date=${filterEndDate}`);

            const queryString = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";

            const [expRes, sumRes, vehRes, tripRes, drvRes] = await Promise.all([
                api.get(`/expenses${queryString}`),
                api.get(`/expenses/summary${queryString}`),
                api.get("/vehicles"),
                api.get("/trips"),
                api.get("/drivers")
            ]);

            if (expRes.data && expRes.data.success) {
                setExpenses(expRes.data.data || []);
            } else {
                setError("Unable to load expenses. Please try again.");
            }

            if (sumRes.data && sumRes.data.success) {
                setSummary(sumRes.data.data);
            }

            if (vehRes.data && vehRes.data.success) {
                setVehicles(vehRes.data.data || []);
            }

            if (tripRes.data && tripRes.data.success) {
                setTrips(tripRes.data.data || []);
            }

            if (drvRes.data && drvRes.data.success) {
                setDrivers(drvRes.data.data || []);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Unable to load expenses. Please try again.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filterCategory, filterVehicle, filterTrip, filterStartDate, filterEndDate]);

    // Open Add Modal
    const handleOpenAddModal = () => {
        setModalMode("add");
        const timestamp = Date.now();
        const today = new Date().toISOString().slice(0, 10);

        setFormData({
            expense_number: `EXP-${timestamp.toString().slice(-6)}`,
            expense_date: today,
            category: "Toll",
            amount: "",
            description: "",
            vendor: "",
            reference_number: "",
            vehicle_id: "",
            trip_id: "",
            driver_id: "",
            notes: ""
        });
        setFormError("");
        setShowModal(true);
    };

    // Open Edit Modal
    const handleOpenEditModal = (expense) => {
        setModalMode("edit");
        setSelectedExpense(expense);

        const fmtDate = expense.expense_date ? new Date(expense.expense_date).toISOString().slice(0, 10) : "";

        setFormData({
            expense_number: expense.expense_number || "",
            expense_date: fmtDate,
            category: expense.category || expense.expense_type || "Toll",
            amount: expense.amount !== undefined ? expense.amount : "",
            description: expense.description || "",
            vendor: expense.vendor || "",
            reference_number: expense.reference_number || "",
            vehicle_id: expense.vehicle_id || "",
            trip_id: expense.trip_id || "",
            driver_id: expense.driver_id || "",
            notes: expense.notes || ""
        });
        setFormError("");
        setShowModal(true);
    };

    // Open View Modal
    const handleOpenViewModal = (expense) => {
        setModalMode("view");
        setSelectedExpense(expense);
        setShowModal(true);
    };

    // Form Input Change Handler with Smart Relationship Selection (Phase 14)
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        if (name === "trip_id" && value) {
            // Smart auto-selection: find selected trip and set its associated vehicle and driver
            const matchedTrip = trips.find(t => t.id === value);
            if (matchedTrip) {
                setFormData(prev => ({
                    ...prev,
                    trip_id: value,
                    vehicle_id: matchedTrip.vehicle_id || prev.vehicle_id,
                    driver_id: matchedTrip.driver_id || prev.driver_id
                }));
                return;
            }
        }

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Submit Add or Edit Form
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setFormError("");

        // Client-side Validation
        if (!formData.expense_number.trim()) {
            setFormError("Expense Number is required.");
            return;
        }
        if (!formData.expense_date) {
            setFormError("Expense Date is required.");
            return;
        }
        if (!formData.category) {
            setFormError("Category is required.");
            return;
        }
        if (!formData.amount || isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
            setFormError("Amount must be greater than 0.");
            return;
        }
        if (!formData.description.trim()) {
            setFormError("Description is required.");
            return;
        }

        // Relationship Validation Check
        if (formData.trip_id) {
            const matchedTrip = trips.find(t => t.id === formData.trip_id);
            if (matchedTrip) {
                if (formData.vehicle_id && matchedTrip.vehicle_id && matchedTrip.vehicle_id !== formData.vehicle_id) {
                    setFormError("Selected vehicle is not assigned to this trip.");
                    return;
                }
                if (formData.driver_id && matchedTrip.driver_id && matchedTrip.driver_id !== formData.driver_id) {
                    setFormError("Selected driver is not assigned to this trip.");
                    return;
                }
            }
        }

        setSubmitting(true);

        const payload = {
            expense_number: formData.expense_number.trim(),
            expense_date: formData.expense_date,
            category: formData.category,
            expense_type: formData.category,
            amount: parseFloat(formData.amount),
            description: formData.description.trim(),
            vendor: formData.vendor.trim() || null,
            reference_number: formData.reference_number.trim() || null,
            vehicle_id: formData.vehicle_id || null,
            trip_id: formData.trip_id || null,
            driver_id: formData.driver_id || null,
            notes: formData.notes.trim() || null
        };

        try {
            if (modalMode === "add") {
                const res = await api.post("/expenses", payload);
                if (res.data && res.data.success) {
                    setSuccessMessage(`Expense ${payload.expense_number} recorded successfully.`);
                    setShowModal(false);
                    fetchData();
                    setTimeout(() => setSuccessMessage(""), 4000);
                }
            } else if (modalMode === "edit" && selectedExpense) {
                const res = await api.put(`/expenses/${selectedExpense.id}`, payload);
                if (res.data && res.data.success) {
                    setSuccessMessage(`Expense ${payload.expense_number} updated successfully.`);
                    setShowModal(false);
                    fetchData();
                    setTimeout(() => setSuccessMessage(""), 4000);
                }
            }
        } catch (err) {
            const msg = err.response?.data?.message || `Failed to ${modalMode} expense record.`;
            setFormError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // Confirm Delete Action
    const handleConfirmDelete = async () => {
        if (!deletingExpense) return;

        try {
            const res = await api.delete(`/expenses/${deletingExpense.id}`);
            if (res.data && res.data.success) {
                setSuccessMessage(`Expense ${deletingExpense.expense_number} deleted successfully.`);
                setDeletingExpense(null);
                fetchData();
                setTimeout(() => setSuccessMessage(""), 4000);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to delete expense.";
            alert(msg);
        }
    };

    // Helper: Category Pill Styling
    const getCategoryBadge = (category) => {
        const cat = category || "Other";
        let color = "#9ca3af";
        let bg = "rgba(107, 114, 128, 0.15)";

        if (cat === "Fuel") { color = "#3b82f6"; bg = "rgba(59, 130, 246, 0.15)"; }
        else if (cat === "Maintenance" || cat === "Repair") { color = "#f59e0b"; bg = "rgba(245, 158, 11, 0.15)"; }
        else if (cat === "Toll") { color = "#a78bfa"; bg = "rgba(167, 139, 250, 0.15)"; }
        else if (cat === "Parking") { color = "#14b8a6"; bg = "rgba(20, 184, 166, 0.15)"; }
        else if (cat === "Insurance" || cat === "Permit") { color = "#10b981"; bg = "rgba(16, 185, 129, 0.15)"; }
        else if (cat.includes("Driver")) { color = "#ec4899"; bg = "rgba(236, 72, 153, 0.15)"; }

        return <span className="role-pill" style={{ backgroundColor: bg, color: color, fontWeight: "600" }}>{cat}</span>;
    };

    return (
        <div className="expenses-container">
            {/* Page Header */}
            <div className="flex-between mb-6" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h2 className="header-title" style={{ fontSize: "1.75rem", fontWeight: "700" }}>Expense Management</h2>
                    <p className="text-muted" style={{ fontSize: "0.9rem" }}>Track and manage operational fleet expenses.</p>
                </div>
                <button onClick={handleOpenAddModal} className="btn btn-primary">
                    ➕ Add Expense
                </button>
            </div>

            {/* Metric Summary Cards (Phase 8) */}
            {summary && (
                <div className="metrics-grid mb-6" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "1rem" }}>
                    <div className="card glass-card p-4">
                        <div className="text-muted mb-1" style={{ fontSize: "0.8rem" }}>Total Expenses</div>
                        <div style={{ fontSize: "1.4rem", fontWeight: "700", color: "#10b981" }}>
                            ${summary.total_expenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.2rem" }}>{summary.expense_count} records</div>
                    </div>

                    <div className="card glass-card p-4">
                        <div className="text-muted mb-1" style={{ fontSize: "0.8rem" }}>Fuel Costs</div>
                        <div style={{ fontSize: "1.4rem", fontWeight: "700", color: "#3b82f6" }}>
                            ${summary.fuel_expenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </div>
                    </div>

                    <div className="card glass-card p-4">
                        <div className="text-muted mb-1" style={{ fontSize: "0.8rem" }}>Maintenance</div>
                        <div style={{ fontSize: "1.4rem", fontWeight: "700", color: "#f59e0b" }}>
                            ${summary.maintenance_expenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </div>
                    </div>

                    <div className="card glass-card p-4">
                        <div className="text-muted mb-1" style={{ fontSize: "0.8rem" }}>Tolls</div>
                        <div style={{ fontSize: "1.4rem", fontWeight: "700", color: "#a78bfa" }}>
                            ${summary.toll_expenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </div>
                    </div>

                    <div className="card glass-card p-4">
                        <div className="text-muted mb-1" style={{ fontSize: "0.8rem" }}>Parking</div>
                        <div style={{ fontSize: "1.4rem", fontWeight: "700", color: "#14b8a6" }}>
                            ${summary.parking_expenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </div>
                    </div>

                    <div className="card glass-card p-4">
                        <div className="text-muted mb-1" style={{ fontSize: "0.8rem" }}>Other Operational</div>
                        <div style={{ fontSize: "1.4rem", fontWeight: "700", color: "#ec4899" }}>
                            ${summary.other_expenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
            )}

            {/* Filtering Bar (Phase 18) */}
            <div className="card glass-card p-4 mb-6" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", alignItems: "center" }}>
                <div>
                    <label style={{ fontSize: "0.78rem", color: "#9ca3af", display: "block", marginBottom: "0.2rem" }}>Category</label>
                    <select className="form-control" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                        <option value="">All Categories</option>
                        {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: "0.78rem", color: "#9ca3af", display: "block", marginBottom: "0.2rem" }}>Vehicle</label>
                    <select className="form-control" value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)}>
                        <option value="">All Vehicles</option>
                        {vehicles.map(v => (
                            <option key={v.id} value={v.id}>
                                {v.vehicle_number || v.registration_number || v.vehicle_code}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: "0.78rem", color: "#9ca3af", display: "block", marginBottom: "0.2rem" }}>Trip</label>
                    <select className="form-control" value={filterTrip} onChange={(e) => setFilterTrip(e.target.value)}>
                        <option value="">All Trips</option>
                        {trips.map(t => (
                            <option key={t.id} value={t.id}>
                                {t.trip_number || t.trip_code}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: "0.78rem", color: "#9ca3af", display: "block", marginBottom: "0.2rem" }}>Start Date</label>
                    <input type="date" className="form-control" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} />
                </div>
                <div>
                    <label style={{ fontSize: "0.78rem", color: "#9ca3af", display: "block", marginBottom: "0.2rem" }}>End Date</label>
                    <input type="date" className="form-control" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", height: "100%" }}>
                    <button
                        onClick={() => {
                            setFilterCategory("");
                            setFilterVehicle("");
                            setFilterTrip("");
                            setFilterStartDate("");
                            setFilterEndDate("");
                        }}
                        className="btn"
                        style={{ background: "#1e293b", color: "#9ca3af", width: "100%", height: "38px" }}
                    >
                        Reset Filters
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
                    <button onClick={fetchData} className="btn btn-sm btn-outline-danger" style={{ color: "#ffffff", borderColor: "#ffffff" }}>
                        Retry
                    </button>
                </div>
            )}

            {/* Main Table Roster */}
            <div className="card glass-card p-6">
                {loading ? (
                    <div className="p-8 text-center text-muted">
                        <div className="spinner mb-3" style={{ margin: "0 auto" }}></div>
                        <p>Loading expenses...</p>
                    </div>
                ) : expenses.length === 0 ? (
                    <div className="p-8 text-center" style={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px dashed #2a3447" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>💳</div>
                        <h3 className="font-semibold text-main mb-1" style={{ fontSize: "1.2rem" }}>No expenses found.</h3>
                        <p className="text-muted mb-4" style={{ fontSize: "0.9rem" }}>Record tolls, maintenance, driver allowances, and operating costs in FleetFlow.</p>
                        <button onClick={handleOpenAddModal} className="btn btn-primary">
                            ➕ Add Expense
                        </button>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.92rem" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid #2a3447", color: "#9ca3af" }}>
                                    <th style={{ padding: "0.85rem" }}>Expense #</th>
                                    <th style={{ padding: "0.85rem" }}>Date</th>
                                    <th style={{ padding: "0.85rem" }}>Category</th>
                                    <th style={{ padding: "0.85rem" }}>Amount</th>
                                    <th style={{ padding: "0.85rem" }}>Vehicle</th>
                                    <th style={{ padding: "0.85rem" }}>Trip</th>
                                    <th style={{ padding: "0.85rem" }}>Driver</th>
                                    <th style={{ padding: "0.85rem" }}>Vendor</th>
                                    <th style={{ padding: "0.85rem", textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map((e) => {
                                    const eDate = e.expense_date ? new Date(e.expense_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

                                    return (
                                        <tr key={e.id} style={{ borderBottom: "1px solid #1e293b" }}>
                                            <td style={{ padding: "0.85rem", fontWeight: "600", color: "#ffffff", fontFamily: "monospace" }}>
                                                {e.expense_number}
                                            </td>
                                            <td style={{ padding: "0.85rem" }}>{eDate}</td>
                                            <td style={{ padding: "0.85rem" }}>{getCategoryBadge(e.category || e.expense_type)}</td>
                                            <td style={{ padding: "0.85rem", fontWeight: "600", color: "#10b981" }}>
                                                ${parseFloat(e.amount || 0).toFixed(2)}
                                            </td>
                                            <td style={{ padding: "0.85rem" }}>{e.vehicle_number || "-"}</td>
                                            <td style={{ padding: "0.85rem", fontFamily: "monospace", fontSize: "0.85rem" }}>{e.trip_number || "-"}</td>
                                            <td style={{ padding: "0.85rem" }}>{e.driver_name || "-"}</td>
                                            <td style={{ padding: "0.85rem" }}>{e.vendor || "-"}</td>
                                            <td style={{ padding: "0.85rem", textAlign: "right" }}>
                                                <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                                                    <button onClick={() => handleOpenViewModal(e)} className="btn btn-sm" style={{ background: "#1e293b", color: "#60a5fa" }}>
                                                        👁️ View
                                                    </button>
                                                    <button onClick={() => handleOpenEditModal(e)} className="btn btn-sm" style={{ background: "#1e293b", color: "#f59e0b" }}>
                                                        ✏️ Edit
                                                    </button>
                                                    <button onClick={() => setDeletingExpense(e)} className="btn btn-sm" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
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
                    <div className="card glass-card" style={{ width: "100%", maxWidth: "600px", padding: "2rem", maxHeight: "90vh", overflowY: "auto" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                            <h3 className="card-title">
                                {modalMode === "add" && "➕ Add Expense Record"}
                                {modalMode === "edit" && "✏️ Edit Expense Record"}
                                {modalMode === "view" && "👁️ Expense Details"}
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

                        {modalMode === "view" && selectedExpense ? (
                            <div style={{ fontSize: "0.95rem" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Expense Number</div>
                                        <div style={{ fontWeight: "700", fontSize: "1.1rem", fontFamily: "monospace" }}>
                                            {selectedExpense.expense_number}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Expense Category</div>
                                        <div>{getCategoryBadge(selectedExpense.category || selectedExpense.expense_type)}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Expense Date</div>
                                        <div>{selectedExpense.expense_date ? new Date(selectedExpense.expense_date).toLocaleDateString("en-GB") : "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Amount</div>
                                        <div style={{ fontWeight: "700", fontSize: "1.15rem", color: "#10b981" }}>
                                            ${parseFloat(selectedExpense.amount || 0).toFixed(2)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Associated Vehicle</div>
                                        <div className="font-semibold">{selectedExpense.vehicle_number || "N/A"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Associated Trip</div>
                                        <div className="font-semibold" style={{ fontFamily: "monospace" }}>{selectedExpense.trip_number || "N/A"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Associated Driver</div>
                                        <div className="font-semibold">{selectedExpense.driver_name || "N/A"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Vendor / Payee</div>
                                        <div>{selectedExpense.vendor || "N/A"}</div>
                                    </div>
                                    <div style={{ gridColumn: "span 2" }}>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Reference Number</div>
                                        <div style={{ fontFamily: "monospace" }}>{selectedExpense.reference_number || "N/A"}</div>
                                    </div>
                                    <div style={{ gridColumn: "span 2" }}>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Description</div>
                                        <div>{selectedExpense.description || "N/A"}</div>
                                    </div>
                                    {selectedExpense.notes && (
                                        <div style={{ gridColumn: "span 2" }}>
                                            <div className="text-muted" style={{ fontSize: "0.8rem" }}>Notes</div>
                                            <div>{selectedExpense.notes}</div>
                                        </div>
                                    )}
                                </div>
                                <div style={{ marginTop: "1.5rem", textAlign: "right" }}>
                                    <button onClick={() => setShowModal(false)} className="btn btn-primary">
                                        Close Details
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleFormSubmit}>
                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="expense_number">Expense # *</label>
                                        <input
                                            id="expense_number"
                                            name="expense_number"
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. EXP-1001"
                                            value={formData.expense_number}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="expense_date">Expense Date *</label>
                                        <input
                                            id="expense_date"
                                            name="expense_date"
                                            type="date"
                                            className="form-control"
                                            value={formData.expense_date}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="category">Expense Category *</label>
                                        <select
                                            id="category"
                                            name="category"
                                            className="form-control"
                                            value={formData.category}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            {CATEGORY_OPTIONS.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="amount">Amount ($) *</label>
                                        <input
                                            id="amount"
                                            name="amount"
                                            type="number"
                                            step="0.01"
                                            className="form-control"
                                            placeholder="e.g. 150.50"
                                            value={formData.amount}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="trip_id">Associated Trip (Optional - Auto selects Vehicle & Driver)</label>
                                    <select
                                        id="trip_id"
                                        name="trip_id"
                                        className="form-control"
                                        value={formData.trip_id}
                                        onChange={handleInputChange}
                                    >
                                        <option value="">-- Independent / General Expense --</option>
                                        {trips.map(t => (
                                            <option key={t.id} value={t.id}>
                                                {t.trip_number || t.trip_code} ({t.source || t.origin} ➔ {t.destination})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="vehicle_id">Vehicle (Optional)</label>
                                        <select
                                            id="vehicle_id"
                                            name="vehicle_id"
                                            className="form-control"
                                            value={formData.vehicle_id}
                                            onChange={handleInputChange}
                                        >
                                            <option value="">-- Select Vehicle --</option>
                                            {vehicles.map(v => (
                                                <option key={v.id} value={v.id}>
                                                    {v.vehicle_number || v.registration_number || v.vehicle_code}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="driver_id">Driver (Optional)</label>
                                        <select
                                            id="driver_id"
                                            name="driver_id"
                                            className="form-control"
                                            value={formData.driver_id}
                                            onChange={handleInputChange}
                                        >
                                            <option value="">-- Select Driver --</option>
                                            {drivers.map(d => (
                                                <option key={d.id} value={d.id}>
                                                    {d.name || d.full_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="vendor">Vendor / Payee</label>
                                        <input
                                            id="vendor"
                                            name="vendor"
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. NHAI Toll Plaza"
                                            value={formData.vendor}
                                            onChange={handleInputChange}
                                        />
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="reference_number">Reference / Invoice #</label>
                                        <input
                                            id="reference_number"
                                            name="reference_number"
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. INV-987654"
                                            value={formData.reference_number}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="description">Description *</label>
                                    <input
                                        id="description"
                                        name="description"
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Highway Fastag Toll Charge for Dispatch Trip"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="notes">Notes</label>
                                    <input
                                        id="notes"
                                        name="notes"
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Reimbursed to driver via digital wallet"
                                        value={formData.notes}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ background: "#1e293b", color: "#ffffff" }}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? "Saving..." : (modalMode === "add" ? "Save Expense" : "Update Expense")}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {deletingExpense && (
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
                        <h3 className="card-title mb-2">Delete Expense Record?</h3>
                        <p className="text-muted mb-6" style={{ fontSize: "0.95rem" }}>
                            Are you sure you want to delete expense <strong>{deletingExpense.expense_number}</strong>?
                        </p>
                        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                            <button onClick={() => setDeletingExpense(null)} className="btn" style={{ background: "#1e293b", color: "#ffffff" }}>
                                Keep Expense
                            </button>
                            <button onClick={handleConfirmDelete} className="btn" style={{ background: "#ef4444", color: "#ffffff" }}>
                                Delete Expense
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpensesPage;
