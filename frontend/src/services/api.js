import axios from "axios";

// Create base Axios instance using environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json"
    }
});

// Request Interceptor: Automatically attach JWT Bearer Token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("fleetflow_token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle Unauthorized 401 Responses
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // If unauthorized, clear invalid token if needed
            const currentPath = window.location.pathname;
            if (currentPath !== "/login" && currentPath !== "/register") {
                localStorage.removeItem("fleetflow_token");
                localStorage.removeItem("fleetflow_user");
            }
        }
        return Promise.reject(error);
    }
);

export default api;
