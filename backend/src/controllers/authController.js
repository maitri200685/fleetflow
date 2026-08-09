const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ==========================================
// REGISTER USER
// ==========================================
const register = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            phone,
            role
        } = req.body;

        // ------------------------------------------
        // 1. Validate required fields
        // ------------------------------------------
        if (!name || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: "Name, email, password and role are required"
            });
        }

        // ------------------------------------------
        // 2. Normalize email
        // ------------------------------------------
        const normalizedEmail = email.trim().toLowerCase();

        // ------------------------------------------
        // 3. Check if user already exists
        // ------------------------------------------
        const existingUser = await pool.query(
            `SELECT id
             FROM users
             WHERE email = $1`,
            [normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "User with this email already exists"
            });
        }

        // ------------------------------------------
        // 4. Hash password
        // ------------------------------------------
        const passwordHash = await bcrypt.hash(password, 10);

        // ------------------------------------------
        // 5. Insert user
        // ------------------------------------------
        const result = await pool.query(
            `INSERT INTO users
                (name, email, password_hash, phone, role)
             VALUES
                ($1, $2, $3, $4, $5)
             RETURNING
                id,
                name,
                email,
                phone,
                role,
                status,
                created_at,
                updated_at`,
            [
                name.trim(),
                normalizedEmail,
                passwordHash,
                phone || null,
                role
            ]
        );

        // ------------------------------------------
        // 6. Send response
        // ------------------------------------------
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Register error:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// ==========================================
// LOGIN USER
// ==========================================
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // ------------------------------------------
        // 1. Validate required fields
        // ------------------------------------------
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        // ------------------------------------------
        // 2. Normalize email
        // ------------------------------------------
        const normalizedEmail = email.trim().toLowerCase();

        // ------------------------------------------
        // 3. Find user by email
        // ------------------------------------------
        const result = await pool.query(
            `SELECT
                id,
                name,
                email,
                password_hash,
                phone,
                role,
                status
             FROM users
             WHERE email = $1`,
            [normalizedEmail]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        // ------------------------------------------
        // 4. Check account status
        // ------------------------------------------
        if (user.status !== "ACTIVE" && user.status !== "Active") {
            return res.status(403).json({
                success: false,
                message: "Account is not active"
            });
        }

        // ------------------------------------------
        // 5. Compare password
        // ------------------------------------------
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // ------------------------------------------
        // 6. Generate JWT Token
        // ------------------------------------------
        const token = jwt.sign(
            {
                id: user.id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "1d"
            }
        );

        // ------------------------------------------
        // 7. Send response
        // ------------------------------------------
        res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    status: user.status
                },
                token
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = {
    register,
    login
};
