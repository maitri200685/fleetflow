import React, { useState, useEffect } from "react";
import api from "../services/api";

export const FuelPage = () => {
    const [fuelRecords, setFuelRecords] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicleFilter, setSelectedVehicleFilter] = useState("");

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
        fuel_date: "",
        odometer: "",
        liters: "",
        price_per_liter: "",
        fuel_station: "",
        notes: ""
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
            const [fuelRes, vehRes] = await Promise.all([
                api.get(selectedVehicleFilter ? `/fuel?vehicle_id=${selectedVehicleFilter}` : "/fuel"),
                api.get("/vehicles")
            ]);

            if (fuelRes.data && fuelRes.data.success) {
                setFuelRecords(fuelRes.data.data || []);
            } else {
                setError("Unable to load fuel records. Please try again.");
            }

            if (vehRes.data && vehRes.data.success) {
                setVehicles(vehRes.data.data || []);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Unable to load fuel records. Please try again.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedVehicleFilter]);

    // Eligible Vehicles (Exclude INACTIVE or OUT_OF_SERVICE)
    const eligibleVehicles = vehicles.filter(v => {
        const s = (v.status || "").toUpperCase();
        return s !== "INACTIVE" && s !== "OUT_OF_SERVICE";
    });

    // Open Add Modal
    const handleOpenAddModal = () => {
        setModalMode("add");
        const today = new Date().toISOString().slice(0, 10);
        setFormData({
            vehicle_id: eligibleVehicles.length > 0 ? eligibleVehicles[0].id : "",
            fuel_date: today,
            odometer: "",
            liters: "",
            price_per_liter: "",
            fuel_station: "",
            notes: ""
        });
        setFormError("");
        setShowModal(true);
    };

    // Open Edit Modal
    const handleOpenEditModal = (record) => {
        setModalMode("edit");
        setSelectedRecord(record);
        const fmtDate = record.fuel_date ? new Date(record.fuel_date).toISOString().slice(0, 10) : "";

        setFormData({
            vehicle_id: record.vehicle_id || "",
            fuel_date: fmtDate,
            odometer: record.odometer !== undefined ? record.odometer : (record.odometer_km || ""),
            liters: record.liters !== undefined ? record.liters : (record.quantity_liters || ""),
            price_per_liter: record.price_per_liter || "",
            fuel_station: record.fuel_station || record.station_name || "",
            notes: record.notes || ""
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

    // Calculate Real-time Display Total Cost for Add/Edit Modal
    const calculatedModalTotalCost = () => {
        const l = parseFloat(formData.liters);
        const p = parseFloat(formData.price_per_liter);
        if (!isNaN(l) && !isNaN(p) && l > 0 && p > 0) {
            return (Math.round(l * p * 100) / 100).toFixed(2);
        }
        return "0.00";
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
        if (!formData.fuel_date) {
            setFormError("Fuel Date is required.");
            return;
        }
        if (!formData.odometer || isNaN(parseFloat(formData.odometer)) || parseFloat(formData.odometer) < 0) {
            setFormError("Odometer reading must be a non-negative number.");
            return;
        }
        if (!formData.liters || isNaN(parseFloat(formData.liters)) || parseFloat(formData.liters) <= 0) {
            setFormError("Fuel quantity (Liters) must be greater than 0.");
            return;
        }
        if (!formData.price_per_liter || isNaN(parseFloat(formData.price_per_liter)) || parseFloat(formData.price_per_liter) <= 0) {
            setFormError("Price per Liter must be greater than 0.");
            return;
        }

        setSubmitting(true);

        const payload = {
            vehicle_id: formData.vehicle_id,
            fuel_date: formData.fuel_date,
            odometer: parseFloat(formData.odometer),
            odometer_km: parseFloat(formData.odometer),
            liters: parseFloat(formData.liters),
            quantity_liters: parseFloat(formData.liters),
            price_per_liter: parseFloat(formData.price_per_liter),
            fuel_station: formData.fuel_station.trim() || null,
            station_name: formData.fuel_station.trim() || null,
            notes: formData.notes.trim() || null
        };

        try {
            if (modalMode === "add") {
                const res = await api.post("/fuel", payload);
                if (res.data && res.data.success) {
                    setSuccessMessage("Fuel record added successfully.");
                    setShowModal(false);
                    fetchData();
                    setTimeout(() => setSuccessMessage(""), 4000);
                }
            } else if (modalMode === "edit" && selectedRecord) {
                const res = await api.put(`/fuel/${selectedRecord.id}`, payload);
                if (res.data && res.data.success) {
                    setSuccessMessage("Fuel record updated successfully.");
                    setShowModal(false);
                    fetchData();
                    setTimeout(() => setSuccessMessage(""), 4000);
                }
            }
        } catch (err) {
            const msg = err.response?.data?.message || `Failed to ${modalMode} fuel record.`;
            setFormError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // Confirm Delete Action
    const handleConfirmDelete = async () => {
        if (!deletingRecord) return;

        try {
            const res = await api.delete(`/fuel/${deletingRecord.id}`);
            if (res.data && res.data.success) {
                setSuccessMessage("Fuel record deleted successfully.");
                setDeletingRecord(null);
                fetchData();
                setTimeout(() => setSuccessMessage(""), 4000);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to delete fuel record.";
            alert(msg);
        }
    };

    // Calculate Summary Metrics Cards (Phase 15)
    const totalFuelUsed = fuelRecords.reduce((acc, r) => acc + (r.liters || r.quantity_liters || 0), 0);
    const totalFuelCost = fuelRecords.reduce((acc, r) => acc + (r.total_cost || 0), 0);
    const avgPricePerLiter = totalFuelUsed > 0 ? (totalFuelCost / totalFuelUsed) : 0;
    
    // Average efficiency across records with calculated efficiency
    const validEfficiencies = fuelRecords.map(r => r.efficiency).filter(e => e !== null && e !== undefined && !isNaN(e));
    const avgEfficiency = validEfficiencies.length > 0
        ? Math.round((validEfficiencies.reduce((a, b) => a + b, 0) / validEfficiencies.length) * 100) / 100
        : null;

    return (
        <div className="fuel-container">
            {/* Page Header */}
            <div className="flex-between mb-6" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h2 className="header-title" style={{ fontSize: "1.75rem", fontWeight: "700" }}>Fuel Management</h2>
                    <p className="text-muted" style={{ fontSize: "0.9rem" }}>Track fuel consumption, costs and vehicle efficiency.</p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <select
                        className="form-control"
                        style={{ width: "220px" }}
                        value={selectedVehicleFilter}
                        onChange={(e) => setSelectedVehicleFilter(e.target.value)}
                    >
                        <option value="">All Vehicles</option>
                        {vehicles.map(v => (
                            <option key={v.id} value={v.id}>
                                {v.vehicle_number || v.registration_number || v.vehicle_code}
                            </option>
                        ))}
                    </select>
                    <button onClick={handleOpenAddModal} className="btn btn-primary">
                        ➕ Add Fuel Log
                    </button>
                </div>
            </div>

            {/* Metric Summary Cards (Phase 15) */}
            <div className="metrics-grid mb-6" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <div className="card glass-card p-4">
                    <div className="text-muted mb-1" style={{ fontSize: "0.8rem" }}>Total Fuel Used</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#3b82f6" }}>
                        {totalFuelUsed > 0 ? `${totalFuelUsed.toLocaleString("en-US", { maximumFractionDigits: 2 })} L` : "0 L"}
                    </div>
                </div>

                <div className="card glass-card p-4">
                    <div className="text-muted mb-1" style={{ fontSize: "0.8rem" }}>Total Fuel Cost</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#10b981" }}>
                        {totalFuelCost > 0 ? `$${totalFuelCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00"}
                    </div>
                </div>

                <div className="card glass-card p-4">
                    <div className="text-muted mb-1" style={{ fontSize: "0.8rem" }}>Average Price / Liter</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#f59e0b" }}>
                        {avgPricePerLiter > 0 ? `$${avgPricePerLiter.toFixed(2)} / L` : "$0.00 / L"}
                    </div>
                </div>

                <div className="card glass-card p-4">
                    <div className="text-muted mb-1" style={{ fontSize: "0.8rem" }}>Average Fuel Efficiency</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#a78bfa" }}>
                        {avgEfficiency !== null ? `${avgEfficiency} km/L` : "N/A"}
                    </div>
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

            {/* Main Roster Card */}
            <div className="card glass-card p-6">
                {loading ? (
                    <div className="p-8 text-center text-muted">
                        <div className="spinner mb-3" style={{ margin: "0 auto" }}></div>
                        <p>Loading fuel records...</p>
                    </div>
                ) : fuelRecords.length === 0 ? (
                    <div className="p-8 text-center" style={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px dashed #2a3447" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>⛽</div>
                        <h3 className="font-semibold text-main mb-1" style={{ fontSize: "1.2rem" }}>No fuel records available.</h3>
                        <p className="text-muted mb-4" style={{ fontSize: "0.9rem" }}>Record vehicle refueling logs to track mileage, cost, and efficiency.</p>
                        <button onClick={handleOpenAddModal} className="btn btn-primary">
                            ➕ Add Fuel Log
                        </button>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.92rem" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid #2a3447", color: "#9ca3af" }}>
                                    <th style={{ padding: "0.85rem" }}>Vehicle</th>
                                    <th style={{ padding: "0.85rem" }}>Date</th>
                                    <th style={{ padding: "0.85rem" }}>Odometer</th>
                                    <th style={{ padding: "0.85rem" }}>Liters</th>
                                    <th style={{ padding: "0.85rem" }}>Price/L</th>
                                    <th style={{ padding: "0.85rem" }}>Total Cost</th>
                                    <th style={{ padding: "0.85rem" }}>Fuel Station</th>
                                    <th style={{ padding: "0.85rem" }}>Efficiency</th>
                                    <th style={{ padding: "0.85rem", textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fuelRecords.map((f) => {
                                    const fDate = f.fuel_date ? new Date(f.fuel_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";
                                    const odoVal = f.odometer !== undefined ? f.odometer : (f.odometer_km || 0);
                                    const litersVal = f.liters !== undefined ? f.liters : (f.quantity_liters || 0);

                                    return (
                                        <tr key={f.id} style={{ borderBottom: "1px solid #1e293b" }}>
                                            <td style={{ padding: "0.85rem", fontWeight: "600", color: "#ffffff" }}>
                                                {f.vehicle_number || f.registration_number || f.vehicle_code}
                                            </td>
                                            <td style={{ padding: "0.85rem" }}>{fDate}</td>
                                            <td style={{ padding: "0.85rem" }}>{parseFloat(odoVal).toLocaleString()} km</td>
                                            <td style={{ padding: "0.85rem" }}>{parseFloat(litersVal).toFixed(2)} L</td>
                                            <td style={{ padding: "0.85rem" }}>${parseFloat(f.price_per_liter || 0).toFixed(2)}</td>
                                            <td style={{ padding: "0.85rem", fontWeight: "600", color: "#10b981" }}>
                                                ${parseFloat(f.total_cost || 0).toFixed(2)}
                                            </td>
                                            <td style={{ padding: "0.85rem" }}>{f.fuel_station || f.station_name || "-"}</td>
                                            <td style={{ padding: "0.85rem" }}>
                                                {f.efficiency !== null && f.efficiency !== undefined ? (
                                                    <span className="role-pill" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981", fontWeight: "600" }}>
                                                        ⚡ {f.efficiency} km/L
                                                    </span>
                                                ) : (
                                                    <span style={{ color: "#9ca3af", fontSize: "0.85rem" }}>N/A (Initial)</span>
                                                )}
                                            </td>
                                            <td style={{ padding: "0.85rem", textAlign: "right" }}>
                                                <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                                                    <button onClick={() => handleOpenViewModal(f)} className="btn btn-sm" style={{ background: "#1e293b", color: "#60a5fa" }}>
                                                        👁️ View
                                                    </button>
                                                    <button onClick={() => handleOpenEditModal(f)} className="btn btn-sm" style={{ background: "#1e293b", color: "#f59e0b" }}>
                                                        ✏️ Edit
                                                    </button>
                                                    <button onClick={() => setDeletingRecord(f)} className="btn btn-sm" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
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
                    <div className="card glass-card" style={{ width: "100%", maxWidth: "580px", padding: "2rem", maxHeight: "90vh", overflowY: "auto" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                            <h3 className="card-title">
                                {modalMode === "add" && "➕ Record Fuel Log"}
                                {modalMode === "edit" && "✏️ Edit Fuel Log"}
                                {modalMode === "view" && "👁️ Fuel Log Details"}
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
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Fuel Date</div>
                                        <div>{selectedRecord.fuel_date ? new Date(selectedRecord.fuel_date).toLocaleDateString("en-GB") : "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Odometer (km)</div>
                                        <div className="font-semibold">
                                            {parseFloat(selectedRecord.odometer !== undefined ? selectedRecord.odometer : (selectedRecord.odometer_km || 0)).toLocaleString()} km
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Fuel Quantity</div>
                                        <div className="font-semibold">
                                            {parseFloat(selectedRecord.liters !== undefined ? selectedRecord.liters : (selectedRecord.quantity_liters || 0)).toFixed(2)} L
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Price / Liter</div>
                                        <div className="font-semibold">${parseFloat(selectedRecord.price_per_liter || 0).toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Calculated Total Cost</div>
                                        <div className="font-semibold" style={{ color: "#10b981", fontSize: "1.1rem" }}>
                                            ${parseFloat(selectedRecord.total_cost || 0).toFixed(2)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Fuel Station</div>
                                        <div>{selectedRecord.fuel_station || selectedRecord.station_name || "N/A"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Fuel Efficiency</div>
                                        <div>
                                            {selectedRecord.efficiency !== null && selectedRecord.efficiency !== undefined ? `${selectedRecord.efficiency} km/L` : "N/A (First Record)"}
                                        </div>
                                    </div>
                                    {selectedRecord.notes && (
                                        <div style={{ gridColumn: "span 2" }}>
                                            <div className="text-muted" style={{ fontSize: "0.8rem" }}>Notes</div>
                                            <div>{selectedRecord.notes}</div>
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
                                        <option value="">-- Select Active Vehicle --</option>
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
                                        <label htmlFor="fuel_date">Fuel Date *</label>
                                        <input
                                            id="fuel_date"
                                            name="fuel_date"
                                            type="date"
                                            className="form-control"
                                            value={formData.fuel_date}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="odometer">Current Odometer (km) *</label>
                                        <input
                                            id="odometer"
                                            name="odometer"
                                            type="number"
                                            className="form-control"
                                            placeholder="e.g. 10500"
                                            value={formData.odometer}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="liters">Fuel Quantity (Liters) *</label>
                                        <input
                                            id="liters"
                                            name="liters"
                                            type="number"
                                            step="0.01"
                                            className="form-control"
                                            placeholder="e.g. 50.00"
                                            value={formData.liters}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="price_per_liter">Price / Liter ($) *</label>
                                        <input
                                            id="price_per_liter"
                                            name="price_per_liter"
                                            type="number"
                                            step="0.01"
                                            className="form-control"
                                            placeholder="e.g. 2.50"
                                            value={formData.price_per_liter}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Calculated Total Cost Display */}
                                <div className="form-group mb-4" style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", padding: "0.85rem", borderRadius: "6px", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontSize: "0.9rem", color: "#9ca3af" }}>Calculated Total Cost:</span>
                                        <span style={{ fontSize: "1.25rem", fontWeight: "700", color: "#10b981" }}>
                                            ${calculatedModalTotalCost()}
                                        </span>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="fuel_station">Fuel Station / Location</label>
                                    <input
                                        id="fuel_station"
                                        name="fuel_station"
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Shell Express Central Plaza"
                                        value={formData.fuel_station}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="notes">Notes</label>
                                    <input
                                        id="notes"
                                        name="notes"
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Full tank refill after long intercity haul"
                                        value={formData.notes}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ background: "#1e293b", color: "#ffffff" }}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? "Saving..." : (modalMode === "add" ? "Save Fuel Log" : "Update Log")}
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
                        <h3 className="card-title mb-2">Delete Fuel Record?</h3>
                        <p className="text-muted mb-6" style={{ fontSize: "0.95rem" }}>
                            Are you sure you want to delete this fuel record for vehicle <strong>{deletingRecord.vehicle_number || deletingRecord.registration_number || deletingRecord.vehicle_code}</strong>?
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

export default FuelPage;
