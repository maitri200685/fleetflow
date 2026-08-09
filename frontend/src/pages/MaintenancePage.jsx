import React, { useState, useEffect } from "react";
import api from "../services/api";

export const MaintenancePage = () => {
    const [maintenanceRecords, setMaintenanceRecords] = useState([]);
    const [vehicles, setVehicles] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState("add"); // "add" | "edit" | "view"
    const [selectedRecord, setSelectedRecord] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        vehicle_id: "",
        service_type: "",
        service_date: "",
        odometer: "",
        description: "",
        cost: "",
        service_center: "",
        next_service_date: "",
        status: "Scheduled"
    });
    const [formError, setFormError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Delete Modal State
    const [deletingRecord, setDeletingRecord] = useState(null);

    // Fetch All Data
    const fetchData = async () => {
        setLoading(true);
        setError("");
        try {
            const [maintRes, vehRes] = await Promise.all([
                api.get("/maintenance"),
                api.get("/vehicles")
            ]);

            if (maintRes.data && maintRes.data.success) {
                setMaintenanceRecords(maintRes.data.data || []);
            } else {
                setError("Unable to load maintenance records. Please try again.");
            }

            if (vehRes.data && vehRes.data.success) {
                setVehicles(vehRes.data.data || []);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Unable to load maintenance records. Please try again.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter Eligible Vehicles for Maintenance (Exclude INACTIVE or IN_TRANSIT)
    const eligibleVehicles = vehicles.filter(v => {
        const s = (v.status || "").toUpperCase();
        return s !== "INACTIVE" && s !== "IN_TRANSIT";
    });

    // Open Add Modal
    const handleOpenAddModal = () => {
        setModalMode("add");
        const today = new Date().toISOString().slice(0, 10);
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 3);
        const nextMonthStr = nextMonth.toISOString().slice(0, 10);

        setFormData({
            vehicle_id: eligibleVehicles.length > 0 ? eligibleVehicles[0].id : "",
            service_type: "Routine Service & Oil Change",
            service_date: today,
            odometer: "",
            description: "",
            cost: "",
            service_center: "",
            next_service_date: nextMonthStr,
            status: "Scheduled"
        });
        setFormError("");
        setShowModal(true);
    };

    // Open Edit Modal
    const handleOpenEditModal = (record) => {
        setModalMode("edit");
        setSelectedRecord(record);

        const fmtDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : "";

        setFormData({
            vehicle_id: record.vehicle_id || "",
            service_type: record.service_type || record.maintenance_type || "",
            service_date: fmtDate(record.service_date),
            odometer: record.odometer !== undefined ? record.odometer : (record.odometer_km || ""),
            description: record.description || "",
            cost: record.cost !== undefined ? record.cost : "",
            service_center: record.service_center || "",
            next_service_date: fmtDate(record.next_service_date),
            status: record.status || "Scheduled"
        });
        setFormError("");
        setShowModal(true);
    };

    // Open View Modal
    const handleOpenViewModal = (record) => {
        setModalMode("view");
        setSelectedRecord(record);
        setShowModal(true);
    };

    // Form Input Change Handler
    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    // Submit Add or Edit Form
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setFormError("");

        // Client-side Validation
        if (!formData.vehicle_id) {
            setFormError("Please select a Vehicle.");
            return;
        }
        if (!formData.service_type.trim()) {
            setFormError("Service / Maintenance Type is required.");
            return;
        }
        if (!formData.service_date) {
            setFormError("Service Date is required.");
            return;
        }
        if (!formData.description.trim()) {
            setFormError("Description is required.");
            return;
        }
        if (formData.cost && (isNaN(parseFloat(formData.cost)) || parseFloat(formData.cost) < 0)) {
            setFormError("Cost cannot be negative.");
            return;
        }
        if (formData.odometer && (isNaN(parseFloat(formData.odometer)) || parseFloat(formData.odometer) < 0)) {
            setFormError("Odometer value cannot be negative.");
            return;
        }

        setSubmitting(true);

        const payload = {
            vehicle_id: formData.vehicle_id,
            service_type: formData.service_type.trim(),
            maintenance_type: formData.service_type.trim(),
            service_date: formData.service_date,
            odometer: formData.odometer ? parseFloat(formData.odometer) : 0,
            odometer_km: formData.odometer ? parseFloat(formData.odometer) : 0,
            description: formData.description.trim(),
            cost: formData.cost ? parseFloat(formData.cost) : 0,
            service_center: formData.service_center.trim() || null,
            next_service_date: formData.next_service_date || null,
            status: formData.status
        };

        try {
            if (modalMode === "add") {
                const res = await api.post("/maintenance", payload);
                if (res.data && res.data.success) {
                    setSuccessMessage(`Maintenance record added successfully.`);
                    setShowModal(false);
                    fetchData();
                    setTimeout(() => setSuccessMessage(""), 4000);
                }
            } else if (modalMode === "edit" && selectedRecord) {
                const res = await api.put(`/maintenance/${selectedRecord.id}`, payload);
                if (res.data && res.data.success) {
                    setSuccessMessage(`Maintenance record updated successfully.`);
                    setShowModal(false);
                    fetchData();
                    setTimeout(() => setSuccessMessage(""), 4000);
                }
            }
        } catch (err) {
            const msg = err.response?.data?.message || `Failed to ${modalMode} maintenance record.`;
            setFormError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // Confirm Delete Action
    const handleConfirmDelete = async () => {
        if (!deletingRecord) return;

        try {
            const res = await api.delete(`/maintenance/${deletingRecord.id}`);
            if (res.data && res.data.success) {
                setSuccessMessage(`Maintenance record deleted successfully.`);
                setDeletingRecord(null);
                fetchData();
                setTimeout(() => setSuccessMessage(""), 4000);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to delete maintenance record.";
            alert(msg);
        }
    };

    // Helper: Status Badge Styling
    const getStatusBadge = (status) => {
        const s = (status || "").toLowerCase();
        if (s === "scheduled") {
            return <span className="role-pill" style={{ backgroundColor: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>Scheduled</span>;
        } else if (s === "in progress" || s === "in_progress") {
            return <span className="role-pill" style={{ backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>In Progress</span>;
        } else if (s === "completed") {
            return <span className="role-pill" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>Completed</span>;
        } else if (s === "cancelled") {
            return <span className="role-pill" style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>Cancelled</span>;
        } else {
            return <span className="role-pill" style={{ backgroundColor: "rgba(107, 114, 128, 0.15)", color: "#9ca3af" }}>{status}</span>;
        }
    };

    // Helper: Service Due Indicator Calculation (Phase 17)
    const getServiceDueIndicator = (nextDateStr) => {
        if (!nextDateStr) return <span style={{ color: "#9ca3af" }}>-</span>;

        const nextDate = new Date(nextDateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffTime = nextDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
            return (
                <span className="role-pill" style={{ backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#ef4444", fontWeight: "700" }}>
                    ⚠️ Service Due
                </span>
            );
        } else if (diffDays <= 30) {
            return (
                <span className="role-pill" style={{ backgroundColor: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", fontWeight: "600" }}>
                    ⏰ Due in {diffDays}d
                </span>
            );
        } else {
            return (
                <span style={{ fontSize: "0.88rem", color: "#9ca3af" }}>
                    {nextDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
            );
        }
    };

    return (
        <div className="maintenance-container">
            {/* Page Header */}
            <div className="flex-between mb-6" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h2 className="header-title" style={{ fontSize: "1.75rem", fontWeight: "700" }}>Maintenance & Service</h2>
                    <p className="text-muted" style={{ fontSize: "0.9rem" }}>Track vehicle servicing, maintenance history and service schedules.</p>
                </div>
                <button onClick={handleOpenAddModal} className="btn btn-primary">
                    ➕ Add Maintenance
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
                    <button onClick={fetchData} className="btn btn-sm btn-outline-danger" style={{ color: "#ffffff", borderColor: "#ffffff" }}>
                        Retry
                    </button>
                </div>
            )}

            {/* Main Roster Card */}
            <div className="card glass-card p-6">
                {loading ? (
                    <div className="p-8 text-center text-muted">
                        <div className="spinner mb-3" style={{ margin: "0 auto" }}></div>
                        <p>Loading maintenance records...</p>
                    </div>
                ) : maintenanceRecords.length === 0 ? (
                    <div className="p-8 text-center" style={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px dashed #2a3447" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🛠️</div>
                        <h3 className="font-semibold text-main mb-1" style={{ fontSize: "1.2rem" }}>No maintenance records found.</h3>
                        <p className="text-muted mb-4" style={{ fontSize: "0.9rem" }}>Log your first vehicle service or repair record to start tracking maintenance history.</p>
                        <button onClick={handleOpenAddModal} className="btn btn-primary">
                            ➕ Add Maintenance
                        </button>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.92rem" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid #2a3447", color: "#9ca3af" }}>
                                    <th style={{ padding: "0.85rem" }}>Vehicle</th>
                                    <th style={{ padding: "0.85rem" }}>Service Type</th>
                                    <th style={{ padding: "0.85rem" }}>Service Date</th>
                                    <th style={{ padding: "0.85rem" }}>Odometer</th>
                                    <th style={{ padding: "0.85rem" }}>Cost ($)</th>
                                    <th style={{ padding: "0.85rem" }}>Next Service</th>
                                    <th style={{ padding: "0.85rem" }}>Status</th>
                                    <th style={{ padding: "0.85rem", textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {maintenanceRecords.map((m) => {
                                    const sDate = m.service_date ? new Date(m.service_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";
                                    const odoVal = m.odometer !== undefined ? m.odometer : (m.odometer_km || 0);

                                    return (
                                        <tr key={m.id} style={{ borderBottom: "1px solid #1e293b" }}>
                                            <td style={{ padding: "0.85rem", fontWeight: "600", color: "#ffffff" }}>
                                                {m.vehicle_number || m.registration_number || m.vehicle_code}
                                            </td>
                                            <td style={{ padding: "0.85rem" }}>{m.service_type || m.maintenance_type}</td>
                                            <td style={{ padding: "0.85rem" }}>{sDate}</td>
                                            <td style={{ padding: "0.85rem" }}>{parseFloat(odoVal).toLocaleString()} km</td>
                                            <td style={{ padding: "0.85rem", fontWeight: "600", color: "#10b981" }}>
                                                ${parseFloat(m.cost || 0).toFixed(2)}
                                            </td>
                                            <td style={{ padding: "0.85rem" }}>{getServiceDueIndicator(m.next_service_date)}</td>
                                            <td style={{ padding: "0.85rem" }}>{getStatusBadge(m.status)}</td>
                                            <td style={{ padding: "0.85rem", textAlign: "right" }}>
                                                <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                                                    <button onClick={() => handleOpenViewModal(m)} className="btn btn-sm" style={{ background: "#1e293b", color: "#60a5fa" }}>
                                                        👁️ View
                                                    </button>
                                                    <button onClick={() => handleOpenEditModal(m)} className="btn btn-sm" style={{ background: "#1e293b", color: "#f59e0b" }}>
                                                        ✏️ Edit
                                                    </button>
                                                    <button onClick={() => setDeletingRecord(m)} className="btn btn-sm" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
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
                                {modalMode === "add" && "➕ Add Maintenance Record"}
                                {modalMode === "edit" && "✏️ Edit Maintenance Record"}
                                {modalMode === "view" && "👁️ Maintenance Details"}
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

                        {modalMode === "view" && selectedRecord ? (
                            <div style={{ fontSize: "0.95rem" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Vehicle Number</div>
                                        <div style={{ fontWeight: "700", fontSize: "1.1rem" }}>
                                            {selectedRecord.vehicle_number || selectedRecord.registration_number || selectedRecord.vehicle_code}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Status</div>
                                        <div>{getStatusBadge(selectedRecord.status)}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Service Type</div>
                                        <div className="font-semibold">{selectedRecord.service_type || selectedRecord.maintenance_type}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Service Date</div>
                                        <div>{selectedRecord.service_date ? new Date(selectedRecord.service_date).toLocaleDateString("en-GB") : "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Odometer (km)</div>
                                        <div className="font-semibold">
                                            {parseFloat(selectedRecord.odometer !== undefined ? selectedRecord.odometer : (selectedRecord.odometer_km || 0)).toLocaleString()} km
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Total Cost</div>
                                        <div className="font-semibold" style={{ color: "#10b981" }}>
                                            ${parseFloat(selectedRecord.cost || 0).toFixed(2)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Service Center / Garage</div>
                                        <div>{selectedRecord.service_center || "N/A"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Next Service Date</div>
                                        <div>{getServiceDueIndicator(selectedRecord.next_service_date)}</div>
                                    </div>
                                    <div style={{ gridColumn: "span 2" }}>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Description / Work Done</div>
                                        <div>{selectedRecord.description || "N/A"}</div>
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
                                    <label htmlFor="vehicle_id">Select Vehicle *</label>
                                    <select
                                        id="vehicle_id"
                                        name="vehicle_id"
                                        className="form-control"
                                        value={formData.vehicle_id}
                                        onChange={handleInputChange}
                                        disabled={modalMode === "edit"}
                                        required
                                    >
                                        <option value="">-- Select Available Vehicle --</option>
                                        {modalMode === "edit" ? vehicles.map((v) => (
                                            <option key={v.id} value={v.id}>
                                                {v.vehicle_number || v.registration_number || v.vehicle_code} ({v.status})
                                            </option>
                                        )) : eligibleVehicles.map((v) => (
                                            <option key={v.id} value={v.id}>
                                                {v.vehicle_number || v.registration_number || v.vehicle_code} ({v.vehicle_type} - {v.status})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="service_type">Service / Maintenance Type *</label>
                                        <input
                                            id="service_type"
                                            name="service_type"
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. Engine Overhaul, Oil Change"
                                            value={formData.service_type}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="status">Maintenance Status *</label>
                                        <select
                                            id="status"
                                            name="status"
                                            className="form-control"
                                            value={formData.status}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            <option value="Scheduled">Scheduled</option>
                                            <option value="In Progress">In Progress (Locks Vehicle)</option>
                                            <option value="Completed">Completed (Restores Vehicle)</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="service_date">Service Date *</label>
                                        <input
                                            id="service_date"
                                            name="service_date"
                                            type="date"
                                            className="form-control"
                                            value={formData.service_date}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="next_service_date">Next Service Date</label>
                                        <input
                                            id="next_service_date"
                                            name="next_service_date"
                                            type="date"
                                            className="form-control"
                                            value={formData.next_service_date}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="odometer">Odometer (km)</label>
                                        <input
                                            id="odometer"
                                            name="odometer"
                                            type="number"
                                            className="form-control"
                                            placeholder="e.g. 45000"
                                            value={formData.odometer}
                                            onChange={handleInputChange}
                                        />
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="cost">Service Cost ($)</label>
                                        <input
                                            id="cost"
                                            name="cost"
                                            type="number"
                                            step="0.01"
                                            className="form-control"
                                            placeholder="e.g. 350.00"
                                            value={formData.cost}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="service_center">Service Center / Workshop</label>
                                    <input
                                        id="service_center"
                                        name="service_center"
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Authorized Volvo Service Station"
                                        value={formData.service_center}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="description">Work Done / Description *</label>
                                    <textarea
                                        id="description"
                                        name="description"
                                        className="form-control"
                                        rows="3"
                                        placeholder="Describe the maintenance tasks performed or planned..."
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        required
                                    ></textarea>
                                </div>

                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ background: "#1e293b", color: "#ffffff" }}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? "Saving..." : (modalMode === "add" ? "Add Maintenance Record" : "Update Record")}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {deletingRecord && (
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
                        <h3 className="card-title mb-2">Delete Maintenance Record?</h3>
                        <p className="text-muted mb-6" style={{ fontSize: "0.95rem" }}>
                            Are you sure you want to delete this maintenance record for vehicle <strong>{deletingRecord.vehicle_number || deletingRecord.registration_number || deletingRecord.vehicle_code}</strong>?
                        </p>
                        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                            <button onClick={() => setDeletingRecord(null)} className="btn" style={{ background: "#1e293b", color: "#ffffff" }}>
                                Keep Record
                            </button>
                            <button onClick={handleConfirmDelete} className="btn" style={{ background: "#ef4444", color: "#ffffff" }}>
                                Delete Record
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaintenancePage;
