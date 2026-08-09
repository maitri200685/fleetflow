import React from "react";
import { AuthProvider } from "./context/AuthContext";
import AppRoutes from "./routes/AppRoutes";

export function App() {
    return (
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    );
}

export default App;
