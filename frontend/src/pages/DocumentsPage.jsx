import React, { useState, useEffect } from "react";
import api from "../services/api";

const VEHICLE_DOC_TYPES = [
    "Registration",
    "Insurance",
    "PUC",
    "Fitness Certificate",
    "Permit",
    "Other"
];

const DRIVER_DOC_TYPES = [
    "Driving License",
    "Medical Certificate",
    "ID Proof",
    "Other"
];

export const DocumentsPage = () => {
    const [documents, setDocuments] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [summary, setSummary] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Filter States
    const [filterOwnerType, setFilterOwnerType] = useState("");
    const [filterVehicle, setFilterVehicle] = useState("");
    const [filterDriver, setFilterDriver] = useState("");
    const [filterDocType, setFilterDocType] = useState("");
    const [filterStatus, setFilterStatus] = useState("");

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState("add"); // "add" | "edit" | "view"
    const [selectedDocument, setSelectedDocument] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        owner_type: "Vehicle", // "Vehicle" | "Driver"
        vehicle_id: "",
        driver_id: "",
        document_type: "Registration",
        document_number: "",
        issue_date: "",
        expiry_date: "",
        file_name: "",
        notes: ""
    });
    const [formError, setFormError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Delete Modal State
    const [deletingDocument, setDeletingDocument] = useState(null);

    // Fetch Documents & Summaries
    const fetchData = async () => {
        setLoading(true);
        setError("");
        try {
            let queryParams = [];
            if (filterOwnerType) queryParams.push(`owner_type=${filterOwnerType}`);
            if (filterVehicle) queryParams.push(`vehicle_id=${filterVehicle}`);
            if (filterDriver) queryParams.push(`driver_id=${filterDriver}`);
            if (filterDocType) queryParams.push(`document_type=${encodeURIComponent(filterDocType)}`);
            if (filterStatus) queryParams.push(`status=${filterStatus}`);

            const queryString = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";

            const [docRes, sumRes, vehRes, drvRes] = await Promise.all([
                api.get(`/documents${queryString}`),
                api.get(`/documents/compliance/summary`),
                api.get("/vehicles"),
                api.get("/drivers")
            ]);

            if (docRes.data && docRes.data.success) {
                setDocuments(docRes.data.data || []);
            } else {
                setError("Unable to load compliance documents. Please try again.");
            }

            if (sumRes.data && sumRes.data.success) {
                setSummary(sumRes.data.data);
            }

            if (vehRes.data && vehRes.data.success) {
                setVehicles(vehRes.data.data || []);
            }

            if (drvRes.data && drvRes.data.success) {
                setDrivers(drvRes.data.data || []);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Unable to load compliance documents. Please try again.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filterOwnerType, filterVehicle, filterDriver, filterDocType, filterStatus]);

    // Open Add Modal
    const handleOpenAddModal = () => {
        setModalMode("add");
        const today = new Date().toISOString().slice(0, 10);
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        const fmtNextYear = nextYear.toISOString().slice(0, 10);

        setFormData({
            owner_type: "Vehicle",
            vehicle_id: vehicles.length > 0 ? vehicles[0].id : "",
            driver_id: "",
            document_type: "Registration",
            document_number: "",
            issue_date: today,
            expiry_date: fmtNextYear,
            file_name: "",
            notes: ""
        });
        setFormError("");
        setShowModal(true);
    };

    // Open Edit Modal
    const handleOpenEditModal = (doc) => {
        setModalMode("edit");
        setSelectedDocument(doc);

        const isVeh = Boolean(doc.vehicle_id);
        const fmtIssue = doc.issue_date ? new Date(doc.issue_date).toISOString().slice(0, 10) : "";
        const fmtExpiry = doc.expiry_date ? new Date(doc.expiry_date).toISOString().slice(0, 10) : "";

        setFormData({
            owner_type: isVeh ? "Vehicle" : "Driver",
            vehicle_id: doc.vehicle_id || "",
            driver_id: doc.driver_id || "",
            document_type: doc.document_type || (isVeh ? "Registration" : "Driving License"),
            document_number: doc.document_number || "",
            issue_date: fmtIssue,
            expiry_date: fmtExpiry,
            file_name: doc.file_name || "",
            notes: doc.notes || ""
        });
        setFormError("");
        setShowModal(true);
    };

    // Open View Modal
    const handleOpenViewModal = (doc) => {
        setModalMode("view");
        setSelectedDocument(doc);
        setShowModal(true);
    };

    // Smart Owner Selection Handler (Phase 16)
    const handleOwnerTypeChange = (newOwnerType) => {
        if (newOwnerType === "Vehicle") {
            setFormData(prev => ({
                ...prev,
                owner_type: "Vehicle",
                vehicle_id: vehicles.length > 0 ? vehicles[0].id : "",
                driver_id: "",
                document_type: "Registration"
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                owner_type: "Driver",
                vehicle_id: "",
                driver_id: drivers.length > 0 ? drivers[0].id : "",
                document_type: "Driving License"
            }));
        }
    };

    // Form Input Change Handler
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Submit Add or Edit Form
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setFormError("");

        // Client Validation
        if (formData.owner_type === "Vehicle" && !formData.vehicle_id) {
            setFormError("Please select a Vehicle.");
            return;
        }
        if (formData.owner_type === "Driver" && !formData.driver_id) {
            setFormError("Please select a Driver.");
            return;
        }
        if (!formData.document_type) {
            setFormError("Document Type is required.");
            return;
        }
        if (!formData.document_number.trim()) {
            setFormError("Document Number is required.");
            return;
        }
        if (!formData.issue_date) {
            setFormError("Issue Date is required.");
            return;
        }
        if (!formData.expiry_date) {
            setFormError("Expiry Date is required.");
            return;
        }

        const issTime = new Date(formData.issue_date).getTime();
        const expTime = new Date(formData.expiry_date).getTime();
        if (expTime <= issTime) {
            setFormError("Expiry date must be after issue date.");
            return;
        }

        setSubmitting(true);

        const payload = {
            vehicle_id: formData.owner_type === "Vehicle" ? formData.vehicle_id : null,
            driver_id: formData.owner_type === "Driver" ? formData.driver_id : null,
            document_type: formData.document_type.trim(),
            document_number: formData.document_number.trim(),
            issue_date: formData.issue_date,
            expiry_date: formData.expiry_date,
            file_name: formData.file_name.trim() || `${formData.document_type.toLowerCase()}_cert.pdf`,
            file_url: `/uploads/documents/${formData.file_name.trim() || "document.pdf"}`,
            notes: formData.notes.trim() || null
        };

        try {
            if (modalMode === "add") {
                const res = await api.post("/documents", payload);
                if (res.data && res.data.success) {
                    setSuccessMessage(`Document ${payload.document_number} added successfully.`);
                    setShowModal(false);
                    fetchData();
                    setTimeout(() => setSuccessMessage(""), 4000);
                }
            } else if (modalMode === "edit" && selectedDocument) {
                const res = await api.put(`/documents/${selectedDocument.id}`, payload);
                if (res.data && res.data.success) {
                    setSuccessMessage(`Document ${payload.document_number} updated successfully.`);
                    setShowModal(false);
                    fetchData();
                    setTimeout(() => setSuccessMessage(""), 4000);
                }
            }
        } catch (err) {
            const msg = err.response?.data?.message || `Failed to ${modalMode} document.`;
            setFormError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // Confirm Delete Action
    const handleConfirmDelete = async () => {
        if (!deletingDocument) return;

        try {
            const res = await api.delete(`/documents/${deletingDocument.id}`);
            if (res.data && res.data.success) {
                setSuccessMessage(`Document ${deletingDocument.document_number} deleted successfully.`);
                setDeletingDocument(null);
                fetchData();
                setTimeout(() => setSuccessMessage(""), 4000);
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to delete document.";
            alert(msg);
        }
    };

    // Status Pill Renderer
    const getStatusBadge = (status) => {
        let color = "#10b981";
        let bg = "rgba(16, 185, 129, 0.15)";
        let icon = "✅";

        if (status === "Expiring Soon") {
            color = "#f59e0b";
            bg = "rgba(245, 158, 11, 0.15)";
            icon = "⚠️";
        } else if (status === "Expired") {
            color = "#ef4444";
            bg = "rgba(239, 68, 68, 0.15)";
            icon = "🚨";
        } else if (status === "Cancelled") {
            color = "#9ca3af";
            bg = "rgba(107, 114, 128, 0.15)";
            icon = "🚫";
        }

        return (
            <span className="role-pill" style={{ backgroundColor: bg, color: color, fontWeight: "600" }}>
                {icon} {status}
            </span>
        );
    };

    return (
        <div className="documents-container">
            {/* Page Header */}
            <div className="flex-between mb-6" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h2 className="header-title" style={{ fontSize: "1.75rem", fontWeight: "700" }}>Documents & Compliance</h2>
                    <p className="text-muted" style={{ fontSize: "0.9rem" }}>Manage fleet and driver compliance documents.</p>
                </div>
                <button onClick={handleOpenAddModal} className="btn btn-primary">
                    ➕ Add Document
                </button>
            </div>

            {/* Metric Summary Cards (Phase 14) */}
            {summary && (
                <div className="metrics-grid mb-6" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                    <div className="card glass-card p-4">
                        <div className="text-muted mb-1" style={{ fontSize: "0.8rem" }}>Total Documents</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#3b82f6" }}>
                            {summary.total_documents}
                        </div>
                    </div>

                    <div className="card glass-card p-4">
                        <div className="text-muted mb-1" style={{ fontSize: "0.8rem" }}>Valid Documents</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#10b981" }}>
                            {summary.valid_documents}
                        </div>
                    </div>

                    <div className="card glass-card p-4">
                        <div className="text-muted mb-1" style={{ fontSize: "0.8rem" }}>Expiring Soon ($\le$ 30 Days)</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#f59e0b" }}>
                            {summary.expiring_soon}
                        </div>
                    </div>

                    <div className="card glass-card p-4">
                        <div className="text-muted mb-1" style={{ fontSize: "0.8rem" }}>Expired Documents</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#ef4444" }}>
                            {summary.expired_documents}
                        </div>
                    </div>
                </div>
            )}

            {/* Filtering Bar (Phase 20) */}
            <div className="card glass-card p-4 mb-6" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.75rem", alignItems: "center" }}>
                <div>
                    <label style={{ fontSize: "0.78rem", color: "#9ca3af", display: "block", marginBottom: "0.2rem" }}>Owner Resource</label>
                    <select className="form-control" value={filterOwnerType} onChange={(e) => {
                        setFilterOwnerType(e.target.value);
                        setFilterVehicle("");
                        setFilterDriver("");
                        setFilterDocType("");
                    }}>
                        <option value="">All Resources</option>
                        <option value="Vehicle">Vehicle Documents</option>
                        <option value="Driver">Driver Documents</option>
                    </select>
                </div>

                {filterOwnerType === "Vehicle" && (
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
                )}

                {filterOwnerType === "Driver" && (
                    <div>
                        <label style={{ fontSize: "0.78rem", color: "#9ca3af", display: "block", marginBottom: "0.2rem" }}>Driver</label>
                        <select className="form-control" value={filterDriver} onChange={(e) => setFilterDriver(e.target.value)}>
                            <option value="">All Drivers</option>
                            {drivers.map(d => (
                                <option key={d.id} value={d.id}>
                                    {d.name || d.full_name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div>
                    <label style={{ fontSize: "0.78rem", color: "#9ca3af", display: "block", marginBottom: "0.2rem" }}>Document Type</label>
                    <select className="form-control" value={filterDocType} onChange={(e) => setFilterDocType(e.target.value)}>
                        <option value="">All Types</option>
                        {filterOwnerType === "Vehicle" ? VEHICLE_DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)
                            : filterOwnerType === "Driver" ? DRIVER_DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)
                            : [...VEHICLE_DOC_TYPES, ...DRIVER_DOC_TYPES].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                <div>
                    <label style={{ fontSize: "0.78rem", color: "#9ca3af", display: "block", marginBottom: "0.2rem" }}>Compliance Status</label>
                    <select className="form-control" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                        <option value="">All Statuses</option>
                        <option value="Valid">Valid</option>
                        <option value="Expiring Soon">Expiring Soon</option>
                        <option value="Expired">Expired</option>
                        <option value="Cancelled">Cancelled</option>
                    </select>
                </div>

                <div style={{ display: "flex", alignItems: "flex-end", height: "100%" }}>
                    <button
                        onClick={() => {
                            setFilterOwnerType("");
                            setFilterVehicle("");
                            setFilterDriver("");
                            setFilterDocType("");
                            setFilterStatus("");
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
                        <p>Loading compliance documents...</p>
                    </div>
                ) : documents.length === 0 ? (
                    <div className="p-8 text-center" style={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px dashed #2a3447" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📄</div>
                        <h3 className="font-semibold text-main mb-1" style={{ fontSize: "1.2rem" }}>No compliance documents found.</h3>
                        <p className="text-muted mb-4" style={{ fontSize: "0.9rem" }}>Store and track vehicle registration, insurance, PUC, and driving licenses.</p>
                        <button onClick={handleOpenAddModal} className="btn btn-primary">
                            ➕ Add Document
                        </button>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.92rem" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid #2a3447", color: "#9ca3af" }}>
                                    <th style={{ padding: "0.85rem" }}>Document #</th>
                                    <th style={{ padding: "0.85rem" }}>Type</th>
                                    <th style={{ padding: "0.85rem" }}>Owner Resource</th>
                                    <th style={{ padding: "0.85rem" }}>Issue Date</th>
                                    <th style={{ padding: "0.85rem" }}>Expiry Date</th>
                                    <th style={{ padding: "0.85rem" }}>Compliance Status</th>
                                    <th style={{ padding: "0.85rem", textAlign: "right" }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {documents.map((d) => {
                                    const issDate = d.issue_date ? new Date(d.issue_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";
                                    const expDate = d.expiry_date ? new Date(d.expiry_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

                                    return (
                                        <tr key={d.id} style={{ borderBottom: "1px solid #1e293b" }}>
                                            <td style={{ padding: "0.85rem", fontWeight: "600", color: "#ffffff", fontFamily: "monospace" }}>
                                                {d.document_number}
                                            </td>
                                            <td style={{ padding: "0.85rem" }}>
                                                <span className="font-semibold">{d.document_type}</span>
                                            </td>
                                            <td style={{ padding: "0.85rem" }}>
                                                {d.vehicle_number ? (
                                                    <span>🚛 {d.vehicle_number}</span>
                                                ) : d.driver_name ? (
                                                    <span>👨‍✈️ {d.driver_name}</span>
                                                ) : (
                                                    <span className="text-muted">Unassigned</span>
                                                )}
                                            </td>
                                            <td style={{ padding: "0.85rem" }}>{issDate}</td>
                                            <td style={{ padding: "0.85rem", fontWeight: "600" }}>{expDate}</td>
                                            <td style={{ padding: "0.85rem" }}>{getStatusBadge(d.status)}</td>
                                            <td style={{ padding: "0.85rem", textAlign: "right" }}>
                                                <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                                                    <button onClick={() => handleOpenViewModal(d)} className="btn btn-sm" style={{ background: "#1e293b", color: "#60a5fa" }}>
                                                        👁️ View
                                                    </button>
                                                    <button onClick={() => handleOpenEditModal(d)} className="btn btn-sm" style={{ background: "#1e293b", color: "#f59e0b" }}>
                                                        ✏️ Edit
                                                    </button>
                                                    <button onClick={() => setDeletingDocument(d)} className="btn btn-sm" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
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
                                {modalMode === "add" && "➕ Record Compliance Document"}
                                {modalMode === "edit" && "✏️ Edit Compliance Document"}
                                {modalMode === "view" && "👁️ Document Details"}
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

                        {modalMode === "view" && selectedDocument ? (
                            <div style={{ fontSize: "0.95rem" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Document Number</div>
                                        <div style={{ fontWeight: "700", fontSize: "1.1rem", fontFamily: "monospace" }}>
                                            {selectedDocument.document_number}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Document Type</div>
                                        <div style={{ fontWeight: "600" }}>{selectedDocument.document_type}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Owner Resource</div>
                                        <div>
                                            {selectedDocument.vehicle_number ? `🚛 Vehicle ${selectedDocument.vehicle_number}` : `👨‍✈️ Driver ${selectedDocument.driver_name}`}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Compliance Status</div>
                                        <div>{getStatusBadge(selectedDocument.status)}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Issue Date</div>
                                        <div>{selectedDocument.issue_date ? new Date(selectedDocument.issue_date).toLocaleDateString("en-GB") : "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>Expiry Date</div>
                                        <div style={{ fontWeight: "700" }}>{selectedDocument.expiry_date ? new Date(selectedDocument.expiry_date).toLocaleDateString("en-GB") : "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted" style={{ fontSize: "0.8rem" }}>File Metadata</div>
                                        <div style={{ fontSize: "0.85rem", color: "#60a5fa" }}>{selectedDocument.file_name}</div>
                                    </div>
                                    {selectedDocument.notes && (
                                        <div style={{ gridColumn: "span 2" }}>
                                            <div className="text-muted" style={{ fontSize: "0.8rem" }}>Notes</div>
                                            <div>{selectedDocument.notes}</div>
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
                                {/* Owner Type Selector */}
                                <div className="form-group mb-4">
                                    <label>Owner Resource Type *</label>
                                    <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
                                        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                                            <input
                                                type="radio"
                                                name="owner_type"
                                                value="Vehicle"
                                                checked={formData.owner_type === "Vehicle"}
                                                onChange={() => handleOwnerTypeChange("Vehicle")}
                                                disabled={modalMode === "edit"}
                                            />
                                            🚛 Vehicle Document
                                        </label>
                                        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                                            <input
                                                type="radio"
                                                name="owner_type"
                                                value="Driver"
                                                checked={formData.owner_type === "Driver"}
                                                onChange={() => handleOwnerTypeChange("Driver")}
                                                disabled={modalMode === "edit"}
                                            />
                                            👨‍✈️ Driver Document
                                        </label>
                                    </div>
                                </div>

                                {formData.owner_type === "Vehicle" ? (
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
                                            <option value="">-- Select Vehicle --</option>
                                            {vehicles.map(v => (
                                                <option key={v.id} value={v.id}>
                                                    {v.vehicle_number || v.registration_number || v.vehicle_code}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label htmlFor="driver_id">Select Driver *</label>
                                        <select
                                            id="driver_id"
                                            name="driver_id"
                                            className="form-control"
                                            value={formData.driver_id}
                                            onChange={handleInputChange}
                                            disabled={modalMode === "edit"}
                                            required
                                        >
                                            <option value="">-- Select Driver --</option>
                                            {drivers.map(d => (
                                                <option key={d.id} value={d.id}>
                                                    {d.name || d.full_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="document_type">Document Type *</label>
                                        <select
                                            id="document_type"
                                            name="document_type"
                                            className="form-control"
                                            value={formData.document_type}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            {formData.owner_type === "Vehicle" ? (
                                                VEHICLE_DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)
                                            ) : (
                                                DRIVER_DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)
                                            )}
                                        </select>
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="document_number">Document # *</label>
                                        <input
                                            id="document_number"
                                            name="document_number"
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. REG-987654"
                                            value={formData.document_number}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group col">
                                        <label htmlFor="issue_date">Issue Date *</label>
                                        <input
                                            id="issue_date"
                                            name="issue_date"
                                            type="date"
                                            className="form-control"
                                            value={formData.issue_date}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>

                                    <div className="form-group col">
                                        <label htmlFor="expiry_date">Expiry Date *</label>
                                        <input
                                            id="expiry_date"
                                            name="expiry_date"
                                            type="date"
                                            className="form-control"
                                            value={formData.expiry_date}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="file_name">File Name / Metadata (Stores metadata)</label>
                                    <input
                                        id="file_name"
                                        name="file_name"
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. vehicle_rc_certificate.pdf"
                                        value={formData.file_name}
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
                                        placeholder="e.g. National permit valid across all state borders"
                                        value={formData.notes}
                                        onChange={handleInputChange}
                                    />
                                </div>

                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn" style={{ background: "#1e293b", color: "#ffffff" }}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? "Saving..." : (modalMode === "add" ? "Save Document" : "Update Document")}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {deletingDocument && (
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
                        <h3 className="card-title mb-2">Delete Document Record?</h3>
                        <p className="text-muted mb-6" style={{ fontSize: "0.95rem" }}>
                            Are you sure you want to delete document <strong>{deletingDocument.document_number}</strong>?
                        </p>
                        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                            <button onClick={() => setDeletingDocument(null)} className="btn" style={{ background: "#1e293b", color: "#ffffff" }}>
                                Keep Document
                            </button>
                            <button onClick={handleConfirmDelete} className="btn" style={{ background: "#ef4444", color: "#ffffff" }}>
                                Delete Document
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentsPage;
