const pool = require("../config/database");
const { isValidUuid, sendSuccess, sendList, sendError } = require("../utils/validation");

const VALID_STATUSES = ["Active", "Expired", "Expiring Soon", "Inactive"];

/**
 * Helper to calculate document expiry status dynamically based on expiry_date
 */
const computeDocumentStatus = (expiryDate, providedStatus) => {
    if (providedStatus === "Inactive") return "Inactive";
    if (!expiryDate) return providedStatus || "Active";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);

    if (exp < today) return "Expired";

    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    if (exp <= thirtyDaysLater) return "Expiring Soon";

    return "Active";
};

// ==========================================
// GET ALL DOCUMENTS
// ==========================================
const getAllDocuments = async (req, res) => {
    try {
        const { vehicle_id, driver_id, status, document_type } = req.query;
        let query = `
            SELECT 
                d.*,
                v.vehicle_code, v.registration_number,
                dr.driver_code, dr.full_name as driver_name
            FROM documents d
            LEFT JOIN vehicles v ON d.vehicle_id = v.id
            LEFT JOIN drivers dr ON d.driver_id = dr.id
            WHERE 1=1
        `;
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
        if (status) {
            query += ` AND d.status = $${paramIdx++}`;
            params.push(status);
        }
        if (document_type) {
            query += ` AND d.document_type = $${paramIdx++}`;
            params.push(document_type);
        }

        query += " ORDER BY d.created_at DESC";

        const result = await pool.query(query, params);

        // Auto-recalculate status for documents if expiry dates passed
        const formattedRows = result.rows.map(row => ({
            ...row,
            status: computeDocumentStatus(row.expiry_date, row.status)
        }));

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

        const result = await pool.query(
            `
            SELECT 
                d.*,
                v.vehicle_code, v.registration_number,
                dr.driver_code, dr.full_name as driver_name
            FROM documents d
            LEFT JOIN vehicles v ON d.vehicle_id = v.id
            LEFT JOIN drivers dr ON d.driver_id = dr.id
            WHERE d.id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, "Document not found");
        }

        const doc = result.rows[0];
        doc.status = computeDocumentStatus(doc.expiry_date, doc.status);

        return sendSuccess(res, 200, "Document fetched successfully", doc);
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

        const vRes = await pool.query("SELECT id FROM vehicles WHERE id = $1", [id]);
        if (vRes.rows.length === 0) {
            return sendError(res, 404, "Vehicle not found");
        }

        const result = await pool.query(
            "SELECT * FROM documents WHERE vehicle_id = $1 ORDER BY expiry_date ASC, created_at DESC",
            [id]
        );

        const rows = result.rows.map(r => ({
            ...r,
            status: computeDocumentStatus(r.expiry_date, r.status)
        }));

        return sendList(res, 200, rows);
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

        const dRes = await pool.query("SELECT id FROM drivers WHERE id = $1", [id]);
        if (dRes.rows.length === 0) {
            return sendError(res, 404, "Driver not found");
        }

        const result = await pool.query(
            "SELECT * FROM documents WHERE driver_id = $1 ORDER BY expiry_date ASC, created_at DESC",
            [id]
        );

        const rows = result.rows.map(r => ({
            ...r,
            status: computeDocumentStatus(r.expiry_date, r.status)
        }));

        return sendList(res, 200, rows);
    } catch (error) {
        console.error("Error fetching driver documents:", error.message);
        return sendError(res, 500, "Failed to fetch driver documents", error);
    }
};

// ==========================================
// CREATE DOCUMENT
// ==========================================
const createDocument = async (req, res) => {
    try {
        const {
            vehicle_id,
            driver_id,
            document_type,
            document_number,
            issue_date,
            expiry_date,
            file_url,
            status
        } = req.body;

        // Document must belong to at least one entity
        if (!vehicle_id && !driver_id) {
            return sendError(
                res,
                400,
                "A document must belong to at least one entity (vehicle_id or driver_id is required)"
            );
        }

        if (!document_type || !file_url) {
            return sendError(res, 400, "document_type and file_url are required");
        }

        if (vehicle_id) {
            if (!isValidUuid(vehicle_id)) return sendError(res, 400, "Invalid vehicle_id UUID format");
            const vRes = await pool.query("SELECT id FROM vehicles WHERE id = $1", [vehicle_id]);
            if (vRes.rows.length === 0) return sendError(res, 404, "Vehicle not found");
        }

        if (driver_id) {
            if (!isValidUuid(driver_id)) return sendError(res, 400, "Invalid driver_id UUID format");
            const dRes = await pool.query("SELECT id FROM drivers WHERE id = $1", [driver_id]);
            if (dRes.rows.length === 0) return sendError(res, 404, "Driver not found");
        }

        const docStatus = computeDocumentStatus(expiry_date, status);

        if (!VALID_STATUSES.includes(docStatus)) {
            return sendError(res, 400, `Invalid status. Allowed values: ${VALID_STATUSES.join(", ")}`);
        }

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
                status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
            `,
            [
                vehicle_id || null,
                driver_id || null,
                document_type,
                document_number || null,
                issue_date || null,
                expiry_date || null,
                file_url,
                docStatus
            ]
        );

        return sendSuccess(res, 201, "Document created successfully", result.rows[0]);
    } catch (error) {
        console.error("Error creating document:", error.message);
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

        const {
            vehicle_id,
            driver_id,
            document_type,
            document_number,
            issue_date,
            expiry_date,
            file_url,
            status
        } = req.body;

        const existing = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return sendError(res, 404, "Document not found");
        }
        const doc = existing.rows[0];

        const targetVehicleId = vehicle_id !== undefined ? vehicle_id : doc.vehicle_id;
        const targetDriverId = driver_id !== undefined ? driver_id : doc.driver_id;

        if (!targetVehicleId && !targetDriverId) {
            return sendError(
                res,
                400,
                "A document must belong to at least one entity (both vehicle_id and driver_id cannot be NULL)"
            );
        }

        if (vehicle_id) {
            if (!isValidUuid(vehicle_id)) return sendError(res, 400, "Invalid vehicle_id UUID format");
            const vRes = await pool.query("SELECT id FROM vehicles WHERE id = $1", [vehicle_id]);
            if (vRes.rows.length === 0) return sendError(res, 404, "Vehicle not found");
        }

        if (driver_id) {
            if (!isValidUuid(driver_id)) return sendError(res, 400, "Invalid driver_id UUID format");
            const dRes = await pool.query("SELECT id FROM drivers WHERE id = $1", [driver_id]);
            if (dRes.rows.length === 0) return sendError(res, 404, "Driver not found");
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
                file_url = COALESCE($7, file_url),
                status = $8,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
            RETURNING *
            `,
            [
                targetVehicleId,
                targetDriverId,
                document_type,
                document_number,
                issue_date,
                expiry_date,
                file_url,
                docStatus,
                id
            ]
        );

        return sendSuccess(res, 200, "Document updated successfully", result.rows[0]);
    } catch (error) {
        console.error("Error updating document:", error.message);
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

        return sendSuccess(res, 200, "Document deleted successfully", result.rows[0]);
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
    createDocument,
    updateDocument,
    deleteDocument
};
