import React, { useState, useEffect } from "react";
import api from "../services/api";

export const TripsPage = () => {
    const [trips, setTrips] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [drivers, setDrivers] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState("add"); // "add" | "edit" | "view" | "status"
    const [selectedTrip, setSelectedTrip] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        trip_number: "",
        customer_id: "",
        vehicle_id: "",
        driver_id: "",
        source: "",
        destination: "",
        cargo_description: "",
        cargo_weight: "",
        start_datetime: "",
        expected_end_datetime: "",
        status: "Assigned",
        notes: ""
    });
    const [statusUpdateVal, setStatusUpdateVal] = useState("In Transit");
    const [formError, setFormError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Delete Modal State
    const [deletingTrip, setDeletingTrip] = useState(null);

    // Fetch All Data
    const fetchData = async () => {
        setLoading(true);
        setError("");
        try {
            const [tripsRes, custRes, vehRes, drvRes] = await Promise.all([
                api.get("/trips"),
                api.get("/customers"),
                api.get("/vehicles"),
                api.get("/drivers")
            ]);

            if (tripsRes.data && tripsRes.data.success) {
                setTrips(tripsRes.data.data || []);
            } else {
                setError("Unable to load trips. Please try again.");
            }

            if (custRes.data && custRes.data.success) {
                setCustomers((custRes.data.data || []).filter(c => c.status === "Active"));
            }

            if (vehRes.data && vehRes.data.success) {
                setVehicles(vehRes.data.data || []);
            }

            if (drvRes.data && drvRes.data.success) {
                setDrivers(drvRes.data.data || []);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Unable to load trips. Please try again.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter Available Options for Dropdowns
    const availableVehicles = vehicles.filter(v => {
        const s = (v.status || "").toUpperCase();
        return s === "AVAILABLE";
    });

    const availableDrivers = drivers.filter(d => {
        const s = (d.status || "").toLowerCase();
        return s === "available";
    });

    // Open Add Modal
    const handleOpenAddModal = () => {
        setModalMode("add");
        const timestamp = Date.now();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfter = new Date();
        dayAfter.setDate(dayAfter.getDate() + 2);

        setFormData({
            trip_number: `TRIP-${timestamp.toString().slice(-6)}`,
            customer_id: customers.length > 0 ? customers[0].id : "",
            vehicle_id: availableVehicles.length > 0 ? availableVehicles[0].id : "",
            driver_id: availableDrivers.length > 0 ? availableDrivers[0].id : "",
            source: "",
            destination: "",
            cargo_description: "",
            cargo_weight: "",
            start_datetime: tomorrow.toISOString().slice(0, 16),
            expected_end_datetime: dayAfter.toISOString().slice(0, 16),
            status: "Assigned",
            notes: ""
        });
        setFormError("");
        setShowModal(true);
    };

    // Open Edit Modal
    const handleOpenEditModal = (trip) => {
        setModalMode("edit");
        setSelectedTrip(trip);

        const fmtDate = (d) => d ? new Date(d).toISOString().slice(0, 16) : "";

        setFormData({
            trip_number: trip.trip_number || trip.trip_code || "",
            customer_id: trip.customer_id || "",
            vehicle_id: trip.vehicle_id || "",
            driver_id: trip.driver_id || "",
            source: trip.source || trip.origin || "",
            destination: trip.destination || "",
            cargo_description: trip.cargo_description || "",
            cargo_weight: trip.cargo_weight !== undefined ? trip.cargo_weight : (trip.cargo_weight_kg || ""),
            start_datetime: fmtDate(trip.start_datetime || trip.scheduled_start),
            expected_end_datetime: fmtDate(trip.expected_end_datetime || trip.scheduled_end),
            status: trip.status || "Assigned",
            notes: trip.notes || ""
        });
        setFormError("");
        setShowModal(true);
    };

    // Open View Modal
    const handleOpenViewModal = (trip) => {
        setModalMode("view");
        setSelectedTrip(trip);
        setShowModal(true);
    };

    // Open Status Transition Modal
    const handleOpenStatusModal = (trip) => {
        setModalMode("status");
        setSelectedTrip(trip);
        setStatusUpdateVal(trip.status === "Assigned" || trip.status === "Scheduled" ? "In Transit" : "Completed");
        setFormError("");
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

        // Client-side validation
        if (!formData.customer_id) {
            setFormError("Please select a Customer.");
            return;
        }
        if (!formData.vehicle_id) {
            setFormError("Please select a Vehicle.");
            return;
        }
        if (!formData.driver_id) {
            setFormError("Please select a Driver.");
            return;
        }
        if (!formData.source.trim()) {
            setFormError("Source / Origin is required.");
            return;
        }
        if (!formData.destination.trim()) {
            setFormError("Destination is required.");
            return;
        }
        if (!formData.start_datetime) {
            setFormError("Start Date & Time is required.");
            return;
        }
        if (!formData.expected_end_datetime) {
            setFormError("Expected End Date & Time is required.");
            return;
        }
        if (new Date(formData.start_datetime) >= new Date(formData.expected_end_datetime)) {
            setFormError("Start Date & Time must be before Expected End Date & Time.");
            return;
        }
        if (formData.cargo_weight && (isNaN(parseFloat(formData.cargo_weight)) || parseFloat(formData.cargo_weight) <= 0)) {
            setFormError("Cargo weight must be a positive numeric value.");
            return;
        }

        setSubmitting(true);

        const payload = {
            trip_number: formData.trip_number.trim(),
            trip_code: formData.trip_number.trim(),
            customer_id: formData.customer_id,
            vehicle_id: formData.vehicle_id,
            driver_id: formData.driver_id,
            source: formData.source.trim(),
            origin: formData.source.trim(),
            destination: formData.destination.trim(),
            cargo_description: formData.cargo_description.trim() || null,
            cargo_weight: formData.cargo_weight ? parseFloat(formData.cargo_weight) : null,
            cargo_weight_kg: formData.cargo_weight ? parseFloat(formData.cargo_weight) : null,
            start_datetime: new Date(formData.start_datetime).toISOString(),
            scheduled_start: new Date(formData.start_datetime).toISOString(),
            expected_end_datetime: new Date(formData.expected_end_datetime).toISOString(),
            scheduled_end: new Date(formData.expected_end_datetime).toISOString(),
            status: formData.status,
            notes: formData.notes.trim() || null
        };

        try {
            if (modalMode === "add") {
                const res = await api.post("/trips", payload);
                if (res.data && res.data.success) {
                    setSuccessMessage(`Trip ${payload.trip_number} created successfully.`);
                    setShowModal(false);
                    fetchData();
                    setTimeout(() => setSuccessMessage(""), 4000);
                }
            } else if (modalMode === "edit" && selectedTrip) {
                const res = await api.put(`/trips/${selectedTrip.id}`, payload);
                if (res.data && res.data.success) {
                    setSuccessMessage(`Trip ${payload.trip_number} updated successfully.`);
                    setShowModal(false);
                    fetchData();
                    setTimeout(() => setSuccessMessage(""), 4000);
                }
            }
        } catch (err) {
            const msg = err.response?.data?.message || `Failed to ${modalMode} trip.`;
            setFormError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // Submit Quick Status Transition
    const handleStatusSubmit = async (e) => {
        e.preventDefault();
        if (!selectedTrip) return;
        setSubmitting(true);
        setFormError("");

        try {
            const res = await api.put(`/trips/${selectedTrip.id}/status`, { status: statusUpdateVal });
            if (res.data && res.data.success) {
                setSuccessMessage(`Trip ${selectedTrip.trip_number || selectedTrip.trip_code} status updated to ${statusUpdateVal}.`);
                setShowModal(false);
                fetchData();
                setTimeout(() => setSuccessMessage(""), 4000);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to update trip status.";
            setFormError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // Confirm Delete Action
    const handleConfirmDelete = async () => {
        if (!deletingTrip) return;

        try {
            const res = await api.delete(`/trips/${deletingTrip.id}`);
            if (res.data && res.data.success) {
                setSuccessMessage(`Trip ${deletingTrip.trip_number || deletingTrip.trip_code} deleted successfully.`);
                setDeletingTrip(null);
                fetchData();
                setTimeout(() => setSuccessMessage(""), 4000);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to delete trip.";
            alert(msg);
        }
    };

    // Helper: Status Badge Styling
    const getStatusBadge = (status) => {
        const s = (status || "").toLowerCase();
        if (s === "scheduled") {
            return <span className="role-pill" style={{ backgroundColor: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>Scheduled</span>;
        } else if (s === "assigned") {
            return <span className="role-pill" style={{ backgroundColor: "rgba(139, 92, 246, 0.15)", color: "#a78bfa" }}>Assigned</span>;
        } else if (s === "in transit" || s === "in_transit") {
            return <span className="role-pill" style={{ backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>In Transit</span>;
        } else if (s === "completed") {
            return <span className="role-pill" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>Completed</span>;
        } else if (s === "cancelled") {
            return <span className="role-pill" style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>Cancelled</span>;
        } else {
            return <span className="role-pill" style={{ backgroundColor: "rgba(107, 114, 128, 0.15)", color: "#9ca3af" }}>{status}</span>;
        }
    };

    return (
        <div className="trips-container">
            {/* Page Header */}
            <div className="flex-between mb-6" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h2 className="header-title" style={{ fontSize: "1.75rem", fontWeight: "700" }}>Trips & Dispatch</h2>
                    <p className="text-muted" style={{ fontSize: "0.9rem" }}>Schedule, assign and monitor fleet trips.</p>
                </div>
                <button onClick={handleOpenAddModal} className="btn btn-primary">
                    ➕ Create Trip
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

            {/* Main Content / Table */}
            <div className="card glass-card p-6">
                {loading ? (
                    <div className="p-8 text-center text-muted">
                        <div className="spinner mb-3" style={{ margin: "0 auto" }}></div>
                        <p>Loading trips...</p>
                    </div>
                ) : trips.length === 0 ? (
                    <div className="p-8 text-center" style={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px dashed #2a3447" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🗺️</div>
                        <h3 className="font-semibold text-main mb-1" style={{ fontSize: "1.2rem" }}>No trips found.</h3>
                        <p className="text-muted mb-4" style={{ fontSize: "0.9rem" }}>Get started by creating and dispatching your first trip in FleetFlow.</p>
                        <button onClick={handleOpenAddModal} className="btn btn-primary">
                            ➕ Create Trip
                        </button>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.92rem" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid #2a3447", color: "#9ca3af" }}>
                                    <th style={{ padding: "0.85rem" }}>Trip Number</th>
                                    <th style={{ padding: "0.85rem" }}>Customer</th>
                                    <th style={{ padding: "0.85rem" }}>Vehicle</th>
                                    <th style={{ padding: "0.85rem" }}>Driver</th>
                                    <th style={{ padding: "0.85rem" }}>Route</th>
                                    <th style={{ padding: "0.85rem" }}>Start Time</th>
                                    <th style={{ padding: "0.85rem" }}>Status</th>
                                    <th style={{ padding: "0.85rem", textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trips.map((t) => {
                                    const startFmt = (t.start_datetime || t.scheduled_start) ? new Date(t.start_datetime || t.scheduled_start).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

                                    return (
                                        <tr key={t.id} style={{ borderBottom: "1px solid #1e293b" }}>
                                            <td style={{ padding: "0.85rem", fontWeight: "600", color: "#ffffff", fontFamily: "monospace" }}>
                                                {t.trip_number || t.trip_code}
                                            </td>
                                            <td style={{ padding: "0.85rem" }}>{t.customer_name || t.customer || t.customer_company || "-"}</td>
                                            <td style={{ padding: "0.85rem" }}>{t.vehicle_number || t.vehicle || t.registration_number || "-"}</td>
                                            <td style={{ padding: "0.85rem" }}>{t.driver_name || t.driver || t.full_name || "-"}</td>
                                            <td style={{ padding: "0.85rem" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.88rem" }}>
                                                    <span style={{ fontWeight: "600" }}>{t.source || t.origin}</span>
                                                    <span style={{ color: "#60a5fa" }}>➔</span>
                                                    <span style={{ fontWeight: "600" }}>{t.destination}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: "0.85rem" }}>{startFmt}</td>
                                            <td style={{ padding: "0.85rem" }}>{getStatusBadge(t.status)}</td>
                                            <td style={{ padding: "0.85rem", textAlign: "right" }}>
                                                <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                                                    <button onClick={() => handleOpenViewModal(t)} className="btn btn-sm" style={{ background: "#1e293b", color: "#60a5fa" }}>
                                                        👁️ View
                                                    </button>
                                                    <button onClick={() => handleOpenStatusModal(t)} className="btn btn-sm" style={{ background: "#1e293b", color: "#a78bfa" }}>
                                                        🔄 Status
                                                    </button>
                                                    <button onClick={() => handleOpenEditModal(t)} className="btn btn-sm" style={{ background: "#1e293b", color: "#f59e0b" }}>
                                                        ✏️ Edit
                                                    </button>
                                                    <button onClick={() => setDeletingTrip(t)} className="btn btn-sm" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
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

            {/* Modal Dialog for Add / Edit / View / Status */}
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
                                {modalMode === "add" && "➕ Create & Dispatch Trip"}
                                {modalMode === "edit" && "✏️ Edit Trip Details"}
                                {modalMode === "view" && "👁️ Trip Details"}
                                {modalMode === "status" && "🔄 Update Trip Status"}
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

                        {modalMode === "status" && selectedTrip ? (
                            <form onSubmit={handleStatusSubmit}>
                                <div className="form-group mb-4">
                                    <label>Current Status</label>
                                    <div className="mb-3">{getStatusBadge(selectedTrip.status)}</div>
                                </div>
                                <div className="form-group mb-4">
                                    <label htmlFor="statusUpdate">New Trip Status *</label>
                                    <select
                                        id="statusUpdate"
                                        className="form-control"
                                        value={statusUpdateVal}
                                        onChange={(e) => setStatusUpdateVal(e.target.value)}
                                        required
                                    >
                                        <option value="In Transit">In Transit (Start Dispatch)</option>
                                        <option value="Completed">Completed (Finish Trip & Release Resources)</option>
                                        <option value="Cancelled">Cancelled (Cancel Trip & Release Resources)</option>
                                    </select>
                                </div>
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ background: "#1e293b", color: "#ffffff" }}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? "Updating..." : "Update Status"}
                                    </button>
                                </div>
                            </form>
                        ) : modalMode === "view" && selectedTrip ? (
                            <div style={{ fontSize: "0.95rem" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Trip Number</div>
                                        <div style={{ fontWeight: "700", fontSize: "1.1rem", fontFamily: "monospace" }}>
                                            {selectedTrip.trip_number || selectedTrip.trip_code}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Trip Status</div>
                                        <div>{getStatusBadge(selectedTrip.status)}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Customer</div>
                                        <div className="font-semibold">{selectedTrip.customer_name || selectedTrip.customer || selectedTrip.customer_company}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Assigned Vehicle</div>
                                        <div className="font-semibold">{selectedTrip.vehicle_number || selectedTrip.vehicle || selectedTrip.registration_number}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Assigned Driver</div>
                                        <div className="font-semibold">{selectedTrip.driver_name || selectedTrip.driver || selectedTrip.full_name}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Cargo Weight</div>
                                        <div className="font-semibold">
                                            {(selectedTrip.cargo_weight !== undefined ? parseFloat(selectedTrip.cargo_weight) : parseFloat(selectedTrip.cargo_weight_kg || 0)).toLocaleString()} kg
                                        </div>
                                    </div>
                                    <div style={{ gridColumn: "span 2" }}>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Route (Source ➔ Destination)</div>
                                        <div className="font-semibold" style={{ fontSize: "1.05rem" }}>
                                            {selectedTrip.source || selectedTrip.origin} ➔ {selectedTrip.destination}
                                        </div>
                                    </div>
                                    <div style={{ gridColumn: "span 2" }}>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Cargo Description</div>
                                        <div>{selectedTrip.cargo_description || "N/A"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Scheduled Start</div>
                                        <div>{selectedTrip.start_datetime || selectedTrip.scheduled_start ? new Date(selectedTrip.start_datetime || selectedTrip.scheduled_start).toLocaleString() : "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Expected End</div>
                                        <div>{selectedTrip.expected_end_datetime || selectedTrip.scheduled_end ? new Date(selectedTrip.expected_end_datetime || selectedTrip.scheduled_end).toLocaleString() : "-"}</div>
                                    </div>
                                    {selectedTrip.notes && (
                                        <div style={{ gridColumn: "span 2" }}>
                                            <div className="text-muted" style={{ fontSize: "0.8rem" }}>Notes / Special Instructions</div>
                                            <div>{selectedTrip.notes}</div>
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
                                <div className="form-group">
                                    <label htmlFor="trip_number">Trip Number *</label>
                                    <input
                                        id="trip_number"
                                        name="trip_number"
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. TRIP-1001"
                                        value={formData.trip_number}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="customer_id">Select Customer *</label>
                                    <select
                                        id="customer_id"
                                        name="customer_id"
                                        className="form-control"
                                        value={formData.customer_id}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        <option value="">-- Select Active Customer --</option>
                                        {customers.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.company_name || c.contact_person}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="vehicle_id">Select Vehicle *</label>
                                        <select
                                            id="vehicle_id"
                                            name="vehicle_id"
                                            className="form-control"
                                            value={formData.vehicle_id}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            <option value="">-- Select Available Vehicle --</option>
                                            {modalMode === "edit" ? vehicles.map((v) => (
                                                <option key={v.id} value={v.id}>
                                                    {v.vehicle_number || v.registration_number || v.vehicle_code} ({v.status})
                                                </option>
                                            )) : availableVehicles.map((v) => (
                                                <option key={v.id} value={v.id}>
                                                    {v.vehicle_number || v.registration_number || v.vehicle_code} ({v.vehicle_type} - {v.capacity || v.capacity_kg}kg)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="driver_id">Select Driver *</label>
                                        <select
                                            id="driver_id"
                                            name="driver_id"
                                            className="form-control"
                                            value={formData.driver_id}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            <option value="">-- Select Available Driver --</option>
                                            {modalMode === "edit" ? drivers.map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {d.name || d.full_name} ({d.status})
                                                </option>
                                            )) : availableDrivers.map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {d.name || d.full_name} ({d.phone})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="source">Source / Origin *</label>
                                        <input
                                            id="source"
                                            name="source"
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. Ahmedabad Hub"
                                            value={formData.source}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="destination">Destination *</label>
                                        <input
                                            id="destination"
                                            name="destination"
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. Mumbai ICD"
                                            value={formData.destination}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="start_datetime">Start Date & Time *</label>
                                        <input
                                            id="start_datetime"
                                            name="start_datetime"
                                            type="datetime-local"
                                            className="form-control"
                                            value={formData.start_datetime}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="expected_end_datetime">Expected End Date & Time *</label>
                                        <input
                                            id="expected_end_datetime"
                                            name="expected_end_datetime"
                                            type="datetime-local"
                                            className="form-control"
                                            value={formData.expected_end_datetime}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="cargo_weight">Cargo Weight (kg)</label>
                                        <input
                                            id="cargo_weight"
                                            name="cargo_weight"
                                            type="number"
                                            className="form-control"
                                            placeholder="e.g. 5000"
                                            value={formData.cargo_weight}
                                            onChange={handleInputChange}
                                        />
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="status">Initial Trip Status *</label>
                                        <select
                                            id="status"
                                            name="status"
                                            className="form-control"
                                            value={formData.status}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            <option value="Assigned">Assigned</option>
                                            <option value="Scheduled">Scheduled</option>
                                            <option value="In Transit">In Transit</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="cargo_description">Cargo Description</label>
                                    <input
                                        id="cargo_description"
                                        name="cargo_description"
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Industrial Machinery Spare Parts"
                                        value={formData.cargo_description}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ background: "#1e293b", color: "#ffffff" }}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? "Saving..." : (modalMode === "add" ? "Create & Dispatch Trip" : "Update Trip")}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Confirm Delete / Cancel Modal */}
            {deletingTrip && (
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
                        <h3 className="card-title mb-2">Delete / Cancel Trip?</h3>
                        <p className="text-muted mb-6" style={{ fontSize: "0.95rem" }}>
                            Are you sure you want to delete trip <strong>{deletingTrip.trip_number || deletingTrip.trip_code}</strong>?
                        </p>
                        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                            <button onClick={() => setDeletingTrip(null)} className="btn" style={{ background: "#1e293b", color: "#ffffff" }}>
                                Keep Trip
                            </button>
                            <button onClick={handleConfirmDelete} className="btn" style={{ background: "#ef4444", color: "#ffffff" }}>
                                Delete Trip
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TripsPage;
