const pool = require("../config/database");
const { isValidUuid, sendSuccess, sendList, sendError } = require("../utils/validation");

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

const VALID_STATUSES = ["Valid", "Expiring Soon", "Expired", "Cancelled", "Active", "Inactive"];

/**
 * Helper to calculate document compliance status dynamically based on expiry_date
 */
const computeDocumentStatus = (expiryDate, providedStatus) => {
    if (providedStatus === "Cancelled") return "Cancelled";
    if (providedStatus === "Inactive") return "Cancelled";
    if (!expiryDate) return "Valid";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);

    if (exp < today) return "Expired";

    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    if (exp <= thirtyDaysLater) return "Expiring Soon";

    return "Valid";
};

// Helper: Standard SQL SELECT with JOINs
const BASE_SELECT = `
    SELECT 
        d.*,
        v.vehicle_number, v.vehicle_code, v.registration_number,
        dr.name as driver_name, dr.full_name as driver_full_name, dr.driver_code
    FROM documents d
    LEFT JOIN vehicles v ON d.vehicle_id = v.id
    LEFT JOIN drivers dr ON d.driver_id = dr.id
`;

// Helper: Normalize document format
const formatDocument = (row) => {
    if (!row) return null;
    const computedSt = computeDocumentStatus(row.expiry_date, row.status);
    const vehNum = row.vehicle_number || row.registration_number || row.vehicle_code || null;
    const drvName = row.driver_name || row.driver_full_name || null;
    const ownerType = row.vehicle_id ? "Vehicle" : (row.driver_id ? "Driver" : "Unknown");

    return {
        ...row,
        status: computedSt,
        owner_type: ownerType,
        vehicle_number: vehNum,
        driver_name: drvName,
        file_name: row.file_name || (row.file_url ? row.file_url.split('/').pop() : "document.pdf"),
        file_path: row.file_path || row.file_url || null,
        file_url: row.file_url || row.file_path || null
    };
};

// ==========================================
// GET ALL DOCUMENTS
// ==========================================
const getAllDocuments = async (req, res) => {
    try {
        const { vehicle_id, driver_id, status, document_type, owner_type } = req.query;
        let query = `${BASE_SELECT} WHERE 1=1`;
        const params = [];
        let paramIdx = 1;

        if (vehicle_id) {
            if (!isValidUuid(vehicle_id)) return sendError(res, 400, "Invalid vehicle_id UUID");
            query += ` AND d.vehicle_id = $${paramIdx++}`;
            params.push(vehicle_id);
        }
        if (driver_id) {
            if (!isValidUuid(driver_id)) return sendError(res, 400, "Invalid driver_id UUID");
            query += ` AND d.driver_id = $${paramIdx++}`;
            params.push(driver_id);
        }
        if (owner_type === "Vehicle") {
            query += ` AND d.vehicle_id IS NOT NULL`;
        } else if (owner_type === "Driver") {
            query += ` AND d.driver_id IS NOT NULL`;
        }

        if (document_type) {
            query += ` AND LOWER(d.document_type) = LOWER($${paramIdx++})`;
            params.push(document_type);
        }

        query += " ORDER BY d.expiry_date ASC, d.created_at DESC";

        const result = await pool.query(query, params);
        let formattedRows = result.rows.map(formatDocument);

        if (status) {
            formattedRows = formattedRows.filter(doc => doc.status.toLowerCase() === status.toLowerCase());
        }

        return sendList(res, 200, formattedRows);
    } catch (error) {
        console.error("Error fetching documents:", error.message);
        return sendError(res, 500, "Failed to fetch documents", error);
    }
};

// ==========================================
// GET DOCUMENT BY ID
// ==========================================
const getDocumentById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for document ID");
        }

        const result = await pool.query(`${BASE_SELECT} WHERE d.id = $1`, [id]);

        if (result.rows.length === 0) {
            return sendError(res, 404, "Document not found");
        }

        return sendSuccess(res, 200, "Document fetched successfully", formatDocument(result.rows[0]));
    } catch (error) {
        console.error("Error fetching document:", error.message);
        return sendError(res, 500, "Failed to fetch document", error);
    }
};

// ==========================================
// GET VEHICLE DOCUMENTS
// ==========================================
const getVehicleDocuments = async (req, res) => {
    try {
        const { id } = req.params; // vehicle_id

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for vehicle ID");
        }

        const vRes = await pool.query("SELECT id, vehicle_number, vehicle_code, registration_number FROM vehicles WHERE id = $1", [id]);
        if (vRes.rows.length === 0) {
            return sendError(res, 404, "Vehicle not found");
        }

        const result = await pool.query(`${BASE_SELECT} WHERE d.vehicle_id = $1 ORDER BY d.expiry_date ASC`, [id]);
        const rows = result.rows.map(formatDocument);

        const expiredCount = rows.filter(r => r.status === "Expired").length;
        const expiringSoonCount = rows.filter(r => r.status === "Expiring Soon").length;
        const validCount = rows.filter(r => r.status === "Valid").length;

        return res.status(200).json({
            success: true,
            message: "Vehicle documents fetched successfully",
            count: rows.length,
            summary: {
                total_documents: rows.length,
                valid_documents: validCount,
                expiring_soon: expiringSoonCount,
                expired_documents: expiredCount
            },
            data: rows
        });
    } catch (error) {
        console.error("Error fetching vehicle documents:", error.message);
        return sendError(res, 500, "Failed to fetch vehicle documents", error);
    }
};

// ==========================================
// GET DRIVER DOCUMENTS
// ==========================================
const getDriverDocuments = async (req, res) => {
    try {
        const { id } = req.params; // driver_id

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for driver ID");
        }

        const dRes = await pool.query("SELECT id, name, full_name FROM drivers WHERE id = $1", [id]);
        if (dRes.rows.length === 0) {
            return sendError(res, 404, "Driver not found");
        }

        const result = await pool.query(`${BASE_SELECT} WHERE d.driver_id = $1 ORDER BY d.expiry_date ASC`, [id]);
        const rows = result.rows.map(formatDocument);

        const expiredCount = rows.filter(r => r.status === "Expired").length;
        const expiringSoonCount = rows.filter(r => r.status === "Expiring Soon").length;
        const validCount = rows.filter(r => r.status === "Valid").length;

        return res.status(200).json({
            success: true,
            message: "Driver documents fetched successfully",
            count: rows.length,
            summary: {
                total_documents: rows.length,
                valid_documents: validCount,
                expiring_soon: expiringSoonCount,
                expired_documents: expiredCount
            },
            data: rows
        });
    } catch (error) {
        console.error("Error fetching driver documents:", error.message);
        return sendError(res, 500, "Failed to fetch driver documents", error);
    }
};

// ==========================================
// GET COMPLIANCE SUMMARY
// ==========================================
const getComplianceSummary = async (req, res) => {
    try {
        const result = await pool.query(`${BASE_SELECT}`);
        const allDocs = result.rows.map(formatDocument);

        const totalDocuments = allDocs.length;
        const validDocuments = allDocs.filter(d => d.status === "Valid").length;
        const expiringSoon = allDocs.filter(d => d.status === "Expiring Soon").length;
        const expiredDocuments = allDocs.filter(d => d.status === "Expired").length;
        const cancelledDocuments = allDocs.filter(d => d.status === "Cancelled").length;

        const vehiclesWithExpired = new Set(allDocs.filter(d => d.vehicle_id && d.status === "Expired").map(d => d.vehicle_id)).size;
        const driversWithExpired = new Set(allDocs.filter(d => d.driver_id && d.status === "Expired").map(d => d.driver_id)).size;
        const vehiclesWithExpiring = new Set(allDocs.filter(d => d.vehicle_id && d.status === "Expiring Soon").map(d => d.vehicle_id)).size;
        const driversWithExpiring = new Set(allDocs.filter(d => d.driver_id && d.status === "Expiring Soon").map(d => d.driver_id)).size;

        return sendSuccess(res, 200, "Compliance summary fetched successfully", {
            total_documents: totalDocuments,
            valid_documents: validDocuments,
            expiring_soon: expiringSoon,
            expired_documents: expiredDocuments,
            cancelled_documents: cancelledDocuments,
            vehicles_with_expired: vehiclesWithExpired,
            drivers_with_expired: driversWithExpired,
            vehicles_with_expiring: vehiclesWithExpiring,
            drivers_with_expiring: driversWithExpiring
        });
    } catch (error) {
        console.error("Error fetching compliance summary:", error.message);
        return sendError(res, 500, "Failed to fetch compliance summary", error);
    }
};

// Helper: Common validation for Create & Update
const validateDocumentInput = async (req, isUpdate = false) => {
    const {
        vehicle_id,
        driver_id,
        document_type,
        document_number,
        issue_date,
        expiry_date,
        status
    } = req.body;

    // XOR Rule: Exactly one owner (vehicle_id XOR driver_id)
    if (!isUpdate) {
        if (!vehicle_id && !driver_id) {
            return { error: "A document must belong to exactly one entity (either vehicle_id or driver_id is required)", status: 400 };
        }
        if (vehicle_id && driver_id) {
            return { error: "A document cannot belong to both vehicle and driver simultaneously", status: 400 };
        }
        if (!document_type || typeof document_type !== "string" || !document_type.trim()) {
            return { error: "document_type is required", status: 400 };
        }
        if (!document_number || typeof document_number !== "string" || !document_number.trim()) {
            return { error: "document_number is required", status: 400 };
        }
        if (!issue_date || isNaN(Date.parse(issue_date))) {
            return { error: "valid issue_date is required", status: 400 };
        }
        if (!expiry_date || isNaN(Date.parse(expiry_date))) {
            return { error: "valid expiry_date is required", status: 400 };
        }
    } else {
        if (vehicle_id && driver_id) {
            return { error: "A document cannot belong to both vehicle and driver simultaneously", status: 400 };
        }
        if (issue_date !== undefined && isNaN(Date.parse(issue_date))) {
            return { error: "valid issue_date is required", status: 400 };
        }
        if (expiry_date !== undefined && isNaN(Date.parse(expiry_date))) {
            return { error: "valid expiry_date is required", status: 400 };
        }
    }

    // Expiry date must be after issue date (Phase 5)
    if (issue_date && expiry_date) {
        const issTime = new Date(issue_date).getTime();
        const expTime = new Date(expiry_date).getTime();
        if (expTime <= issTime) {
            return { error: "expiry_date must be after issue_date", status: 400 };
        }
    }

    // Owner Entity Exists Check
    if (vehicle_id) {
        if (!isValidUuid(vehicle_id)) return { error: "Invalid vehicle_id UUID format", status: 400 };
        const vRes = await pool.query("SELECT id FROM vehicles WHERE id = $1", [vehicle_id]);
        if (vRes.rows.length === 0) return { error: "Vehicle not found", status: 404 };

        if (document_type && !VEHICLE_DOC_TYPES.some(t => t.toLowerCase() === document_type.trim().toLowerCase())) {
            return { error: `Invalid document_type for Vehicle. Allowed values: ${VEHICLE_DOC_TYPES.join(", ")}`, status: 400 };
        }
    }

    if (driver_id) {
        if (!isValidUuid(driver_id)) return { error: "Invalid driver_id UUID format", status: 400 };
        const dRes = await pool.query("SELECT id FROM drivers WHERE id = $1", [driver_id]);
        if (dRes.rows.length === 0) return { error: "Driver not found", status: 404 };

        if (document_type && !DRIVER_DOC_TYPES.some(t => t.toLowerCase() === document_type.trim().toLowerCase())) {
            return { error: `Invalid document_type for Driver. Allowed values: ${DRIVER_DOC_TYPES.join(", ")}`, status: 400 };
        }
    }

    return {};
};

// ==========================================
// CREATE DOCUMENT
// ==========================================
const createDocument = async (req, res) => {
    try {
        const val = await validateDocumentInput(req, false);
        if (val.error) return sendError(res, val.status, val.error);

        const {
            vehicle_id,
            driver_id,
            document_type,
            document_number,
            issue_date,
            expiry_date,
            file_name,
            file_path,
            file_type,
            file_size,
            file_url,
            notes,
            status
        } = req.body;

        const effectiveNumber = document_number.trim();
        const effectiveType = document_type.trim();

        // Duplicate document_number check for same owner (Phase 12)
        if (vehicle_id) {
            const dupCheck = await pool.query(
                "SELECT id FROM documents WHERE vehicle_id = $1 AND LOWER(document_number) = LOWER($2)",
                [vehicle_id, effectiveNumber]
            );
            if (dupCheck.rows.length > 0) {
                return sendError(res, 409, "Document number already exists for this vehicle");
            }
        } else if (driver_id) {
            const dupCheck = await pool.query(
                "SELECT id FROM documents WHERE driver_id = $1 AND LOWER(document_number) = LOWER($2)",
                [driver_id, effectiveNumber]
            );
            if (dupCheck.rows.length > 0) {
                return sendError(res, 409, "Document number already exists for this driver");
            }
        }

        const docStatus = computeDocumentStatus(expiry_date, status);
        const effectiveFileUrl = file_url || file_path || (file_name ? `/uploads/documents/${file_name}` : "http://example.com/doc.pdf");

        const result = await pool.query(
            `
            INSERT INTO documents (
                vehicle_id,
                driver_id,
                document_type,
                document_number,
                issue_date,
                expiry_date,
                file_url,
                file_name,
                file_path,
                file_type,
                file_size,
                notes,
                status
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            )
            RETURNING *
            `,
            [
                vehicle_id || null,
                driver_id || null,
                effectiveType,
                effectiveNumber,
                issue_date,
                expiry_date,
                effectiveFileUrl,
                file_name || null,
                file_path || effectiveFileUrl,
                file_type || "application/pdf",
                file_size ? parseInt(file_size) : null,
                notes ? notes.trim() : null,
                docStatus
            ]
        );

        const joinedRes = await pool.query(`${BASE_SELECT} WHERE d.id = $1`, [result.rows[0].id]);
        return sendSuccess(res, 201, "Document created successfully", formatDocument(joinedRes.rows[0]));
    } catch (error) {
        console.error("Error creating document:", error.message);
        if (error.code === "23505") {
            return sendError(res, 409, "Document number already exists for this resource");
        }
        return sendError(res, 500, "Failed to create document", error);
    }
};

// ==========================================
// UPDATE DOCUMENT
// ==========================================
const updateDocument = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for document ID");
        }

        const existing = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return sendError(res, 404, "Document not found");
        }
        const doc = existing.rows[0];

        const val = await validateDocumentInput(req, true);
        if (val.error) return sendError(res, val.status, val.error);

        const {
            vehicle_id,
            driver_id,
            document_type,
            document_number,
            issue_date,
            expiry_date,
            file_name,
            file_path,
            file_type,
            file_size,
            file_url,
            notes,
            status
        } = req.body;

        const targetVehicleId = vehicle_id !== undefined ? vehicle_id : doc.vehicle_id;
        const targetDriverId = driver_id !== undefined ? driver_id : doc.driver_id;

        if (!targetVehicleId && !targetDriverId) {
            return sendError(res, 400, "A document must belong to exactly one entity");
        }
        if (targetVehicleId && targetDriverId) {
            return sendError(res, 400, "A document cannot belong to both vehicle and driver simultaneously");
        }

        const effectiveNumber = document_number ? document_number.trim() : doc.document_number;

        // Duplicate check on update
        if (document_number && document_number.trim() !== doc.document_number) {
            if (targetVehicleId) {
                const dupCheck = await pool.query(
                    "SELECT id FROM documents WHERE vehicle_id = $1 AND LOWER(document_number) = LOWER($2) AND id != $3",
                    [targetVehicleId, effectiveNumber, id]
                );
                if (dupCheck.rows.length > 0) {
                    return sendError(res, 409, "Document number already exists for this vehicle");
                }
            } else if (targetDriverId) {
                const dupCheck = await pool.query(
                    "SELECT id FROM documents WHERE driver_id = $1 AND LOWER(document_number) = LOWER($2) AND id != $3",
                    [targetDriverId, effectiveNumber, id]
                );
                if (dupCheck.rows.length > 0) {
                    return sendError(res, 409, "Document number already exists for this driver");
                }
            }
        }

        const effectiveExpiry = expiry_date !== undefined ? expiry_date : doc.expiry_date;
        const docStatus = computeDocumentStatus(effectiveExpiry, status || doc.status);

        const result = await pool.query(
            `
            UPDATE documents
            SET
                vehicle_id = $1,
                driver_id = $2,
                document_type = COALESCE($3, document_type),
                document_number = COALESCE($4, document_number),
                issue_date = COALESCE($5, issue_date),
                expiry_date = COALESCE($6, expiry_date),
                file_name = COALESCE($7, file_name),
                file_path = COALESCE($8, file_path),
                file_type = COALESCE($9, file_type),
                file_size = COALESCE($10, file_size),
                file_url = COALESCE($11, file_url),
                notes = COALESCE($12, notes),
                status = $13,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $14
            RETURNING *
            `,
            [
                targetVehicleId,
                targetDriverId,
                document_type ? document_type.trim() : null,
                effectiveNumber,
                issue_date || null,
                expiry_date || null,
                file_name || null,
                file_path || null,
                file_type || null,
                file_size ? parseInt(file_size) : null,
                file_url || null,
                notes ? notes.trim() : null,
                docStatus,
                id
            ]
        );

        const joinedRes = await pool.query(`${BASE_SELECT} WHERE d.id = $1`, [id]);
        return sendSuccess(res, 200, "Document updated successfully", formatDocument(joinedRes.rows[0]));
    } catch (error) {
        console.error("Error updating document:", error.message);
        if (error.code === "23505") {
            return sendError(res, 409, "Document number already exists for this resource");
        }
        return sendError(res, 500, "Failed to update document", error);
    }
};

// ==========================================
// DELETE DOCUMENT
// ==========================================
const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidUuid(id)) {
            return sendError(res, 400, "Invalid UUID format for document ID");
        }

        const result = await pool.query(
            "DELETE FROM documents WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Document not found");
        }

        return sendSuccess(res, 200, "Document deleted successfully", formatDocument(result.rows[0]));
    } catch (error) {
        console.error("Error deleting document:", error.message);
        return sendError(res, 500, "Failed to delete document", error);
    }
};

module.exports = {
    getAllDocuments,
    getDocumentById,
    getVehicleDocuments,
    getDriverDocuments,
    getComplianceSummary,
    createDocument,
    updateDocument,
    deleteDocument
};
