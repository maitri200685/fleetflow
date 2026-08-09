const express = require("express");
const router = express.Router();
const {
    getAllCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deleteCustomer
} = require("../controllers/customerController");
const { authenticateToken, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), getAllCustomers);
router.post("/", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), createCustomer);
router.get("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER", "CUSTOMER"), getCustomerById);
router.put("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), updateCustomer);
router.delete("/:id", authenticateToken, authorizeRoles("ADMIN", "FLEET_MANAGER"), deleteCustomer);

module.exports = router;
