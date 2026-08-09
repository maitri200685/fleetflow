import React, { useState, useEffect } from "react";
import api from "../services/api";

export const VehiclesPage = () => {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState("add"); // "add" | "edit" | "view"
    const [selectedVehicle, setSelectedVehicle] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        vehicle_number: "",
        vehicle_type: "Truck",
        model: "",
        capacity: "",
        status: "Available"
    });
    const [formError, setFormError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Delete Modal State
    const [deletingVehicle, setDeletingVehicle] = useState(null);

    // Fetch Vehicles on Component Mount
    const fetchVehicles = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get("/vehicles");
            if (response.data && response.data.success) {
                setVehicles(response.data.data || []);
            } else {
                setError("Unable to load vehicles. Please try again.");
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Unable to load vehicles. Please try again.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVehicles();
    }, []);

    // Open Modal for Adding Vehicle
    const handleOpenAddModal = () => {
        setModalMode("add");
        setFormData({
            vehicle_number: "",
            vehicle_type: "Truck",
            model: "",
            capacity: "",
            status: "Available"
        });
        setFormError("");
        setShowModal(true);
    };

    // Open Modal for Editing Vehicle
    const handleOpenEditModal = (vehicle) => {
        setModalMode("edit");
        setSelectedVehicle(vehicle);
        setFormData({
            vehicle_number: vehicle.vehicle_number || vehicle.registration_number || vehicle.vehicle_code || "",
            vehicle_type: vehicle.vehicle_type || "Truck",
            model: vehicle.model || "",
            capacity: vehicle.capacity !== undefined ? vehicle.capacity : (vehicle.capacity_kg || ""),
            status: vehicle.status || "Available"
        });
        setFormError("");
        setShowModal(true);
    };

    // Open Modal for Viewing Vehicle
    const handleOpenViewModal = (vehicle) => {
        setModalMode("view");
        setSelectedVehicle(vehicle);
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
        if (!formData.vehicle_number.trim()) {
            setFormError("Vehicle Number is required.");
            return;
        }
        if (!formData.vehicle_type.trim()) {
            setFormError("Vehicle Type is required.");
            return;
        }
        if (!formData.model.trim()) {
            setFormError("Model is required.");
            return;
        }
        if (!formData.capacity || isNaN(parseFloat(formData.capacity)) || parseFloat(formData.capacity) <= 0) {
            setFormError("Capacity must be a valid numeric value greater than zero.");
            return;
        }

        setSubmitting(true);

        const payload = {
            vehicle_number: formData.vehicle_number.trim(),
            vehicle_type: formData.vehicle_type.trim(),
            model: formData.model.trim(),
            capacity: parseFloat(formData.capacity),
            status: formData.status
        };

        try {
            if (modalMode === "add") {
                const res = await api.post("/vehicles", payload);
                if (res.data && res.data.success) {
                    setSuccessMessage(`Vehicle ${payload.vehicle_number} added successfully.`);
                    setShowModal(false);
                    fetchVehicles();
                    setTimeout(() => setSuccessMessage(""), 4000);
                }
            } else if (modalMode === "edit" && selectedVehicle) {
                const res = await api.put(`/vehicles/${selectedVehicle.id}`, payload);
                if (res.data && res.data.success) {
                    setSuccessMessage(`Vehicle ${payload.vehicle_number} updated successfully.`);
                    setShowModal(false);
                    fetchVehicles();
                    setTimeout(() => setSuccessMessage(""), 4000);
                }
            }
        } catch (err) {
            const msg = err.response?.data?.message || `Failed to ${modalMode} vehicle.`;
            setFormError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // Confirm Delete Action
    const handleConfirmDelete = async () => {
        if (!deletingVehicle) return;

        try {
            const res = await api.delete(`/vehicles/${deletingVehicle.id}`);
            if (res.data && res.data.success) {
                setSuccessMessage(`Vehicle ${deletingVehicle.vehicle_number || deletingVehicle.registration_number} deleted successfully.`);
                setDeletingVehicle(null);
                fetchVehicles();
                setTimeout(() => setSuccessMessage(""), 4000);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to delete vehicle.";
            alert(msg);
        }
    };

    // Helper: Status Badge Styling
    const getStatusBadge = (status) => {
        const s = (status || "").toLowerCase();
        if (s === "available") {
            return <span className="role-pill" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>Available</span>;
        } else if (s === "in transit" || s === "in_transit") {
            return <span className="role-pill" style={{ backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>In Transit</span>;
        } else if (s === "maintenance") {
            return <span className="role-pill" style={{ backgroundColor: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>Maintenance</span>;
        } else {
            return <span className="role-pill" style={{ backgroundColor: "rgba(107, 114, 128, 0.15)", color: "#9ca3af" }}>Inactive</span>;
        }
    };

    return (
        <div className="vehicles-container">
            {/* Page Header */}
            <div className="flex-between mb-6" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h2 className="header-title" style={{ fontSize: "1.75rem", fontWeight: "700" }}>Vehicles</h2>
                    <p className="text-muted" style={{ fontSize: "0.9rem" }}>Manage and monitor your fleet vehicles.</p>
                </div>
                <button onClick={handleOpenAddModal} className="btn btn-primary">
                    ➕ Add Vehicle
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
                    <button onClick={fetchVehicles} className="btn btn-sm btn-outline-danger" style={{ color: "#ffffff", borderColor: "#ffffff" }}>
                        Retry
                    </button>
                </div>
            )}

            {/* Main Content / Table */}
            <div className="card glass-card p-6">
                {loading ? (
                    <div className="p-8 text-center text-muted">
                        <div className="spinner mb-3" style={{ margin: "0 auto" }}></div>
                        <p>Loading vehicles...</p>
                    </div>
                ) : vehicles.length === 0 ? (
                    <div className="p-8 text-center" style={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px dashed #2a3447" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🚛</div>
                        <h3 className="font-semibold text-main mb-1" style={{ fontSize: "1.2rem" }}>No vehicles found.</h3>
                        <p className="text-muted mb-4" style={{ fontSize: "0.9rem" }}>Get started by adding your first vehicle to the FleetFlow fleet registry.</p>
                        <button onClick={handleOpenAddModal} className="btn btn-primary">
                            ➕ Add Vehicle
                        </button>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.92rem" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid #2a3447", color: "#9ca3af" }}>
                                    <th style={{ padding: "0.85rem" }}>Vehicle Number</th>
                                    <th style={{ padding: "0.85rem" }}>Vehicle Type</th>
                                    <th style={{ padding: "0.85rem" }}>Model</th>
                                    <th style={{ padding: "0.85rem" }}>Capacity (kg)</th>
                                    <th style={{ padding: "0.85rem" }}>Status</th>
                                    <th style={{ padding: "0.85rem", textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vehicles.map((v) => (
                                    <tr key={v.id} style={{ borderBottom: "1px solid #1e293b" }}>
                                        <td style={{ padding: "0.85rem", fontWeight: "600", color: "#ffffff" }}>
                                            {v.vehicle_number || v.registration_number || v.vehicle_code}
                                        </td>
                                        <td style={{ padding: "0.85rem" }}>{v.vehicle_type}</td>
                                        <td style={{ padding: "0.85rem" }}>{v.model || "-"}</td>
                                        <td style={{ padding: "0.85rem" }}>
                                            {(v.capacity !== undefined ? parseFloat(v.capacity) : parseFloat(v.capacity_kg || 0)).toLocaleString()} kg
                                        </td>
                                        <td style={{ padding: "0.85rem" }}>{getStatusBadge(v.status)}</td>
                                        <td style={{ padding: "0.85rem", textAlign: "right" }}>
                                            <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                                                <button onClick={() => handleOpenViewModal(v)} className="btn btn-sm" style={{ background: "#1e293b", color: "#60a5fa" }}>
                                                    👁️ View
                                                </button>
                                                <button onClick={() => handleOpenEditModal(v)} className="btn btn-sm" style={{ background: "#1e293b", color: "#f59e0b" }}>
                                                    ✏️ Edit
                                                </button>
                                                <button onClick={() => setDeletingVehicle(v)} className="btn btn-sm" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
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
                                {modalMode === "add" && "➕ Add New Vehicle"}
                                {modalMode === "edit" && "✏️ Edit Vehicle"}
                                {modalMode === "view" && "👁️ Vehicle Details"}
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

                        {modalMode === "view" && selectedVehicle ? (
                            <div style={{ fontSize: "0.95rem" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Vehicle Number</div>
                                        <div style={{ fontWeight: "700", fontSize: "1.1rem" }}>
                                            {selectedVehicle.vehicle_number || selectedVehicle.registration_number || selectedVehicle.vehicle_code}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Status</div>
                                        <div>{getStatusBadge(selectedVehicle.status)}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Vehicle Type</div>
                                        <div className="font-semibold">{selectedVehicle.vehicle_type}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Model</div>
                                        <div className="font-semibold">{selectedVehicle.model || "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Capacity</div>
                                        <div className="font-semibold">
                                            {(selectedVehicle.capacity !== undefined ? parseFloat(selectedVehicle.capacity) : parseFloat(selectedVehicle.capacity_kg || 0)).toLocaleString()} kg
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Brand / Make</div>
                                        <div className="font-semibold">{selectedVehicle.brand || "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Created Date</div>
                                        <div>{new Date(selectedVehicle.created_at).toLocaleDateString()}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Updated Date</div>
                                        <div>{selectedVehicle.updated_at ? new Date(selectedVehicle.updated_at).toLocaleDateString() : "-"}</div>
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
                                    <label htmlFor="vehicle_number">Vehicle Number *</label>
                                    <input
                                        id="vehicle_number"
                                        name="vehicle_number"
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. GJ01AB1234"
                                        value={formData.vehicle_number}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="vehicle_type">Vehicle Type *</label>
                                        <select
                                            id="vehicle_type"
                                            name="vehicle_type"
                                            className="form-control"
                                            value={formData.vehicle_type}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            <option value="Truck">Truck</option>
                                            <option value="Van">Van</option>
                                            <option value="Trailer">Trailer</option>
                                            <option value="Bus">Bus</option>
                                            <option value="Car">Car</option>
                                            <option value="Heavy Cargo Truck">Heavy Cargo Truck</option>
                                        </select>
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="model">Model *</label>
                                        <input
                                            id="model"
                                            name="model"
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. Volvo FH16"
                                            value={formData.model}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="capacity">Capacity (kg) *</label>
                                        <input
                                            id="capacity"
                                            name="capacity"
                                            type="number"
                                            step="0.01"
                                            className="form-control"
                                            placeholder="e.g. 5000"
                                            value={formData.capacity}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="status">Status *</label>
                                        <select
                                            id="status"
                                            name="status"
                                            className="form-control"
                                            value={formData.status}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            <option value="Available">Available</option>
                                            <option value="In Transit">In Transit</option>
                                            <option value="Maintenance">Maintenance</option>
                                            <option value="Inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ background: "#1e293b", color: "#ffffff" }}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? "Saving..." : (modalMode === "add" ? "Save Vehicle" : "Update Vehicle")}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {deletingVehicle && (
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
                        <h3 className="card-title mb-2">Delete Vehicle?</h3>
                        <p className="text-muted mb-6" style={{ fontSize: "0.95rem" }}>
                            Are you sure you want to delete vehicle <strong>{deletingVehicle.vehicle_number || deletingVehicle.registration_number}</strong>?
                        </p>
                        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                            <button onClick={() => setDeletingVehicle(null)} className="btn" style={{ background: "#1e293b", color: "#ffffff" }}>
                                Cancel
                            </button>
                            <button onClick={handleConfirmDelete} className="btn" style={{ background: "#ef4444", color: "#ffffff" }}>
                                Delete Vehicle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VehiclesPage;
