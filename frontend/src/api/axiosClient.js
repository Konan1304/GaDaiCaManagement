import axios from "axios";
import { clearSession } from "../utils/auth";

const configuredApiUrl = import.meta.env.VITE_API_URL;
const apiUrl = (() => {
    if (!configuredApiUrl) {
        return `${window.location.protocol}//${window.location.hostname}:5000/api`;
    }

    try {
        const url = new URL(configuredApiUrl);
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
            url.hostname = window.location.hostname;
        }
        return url.toString().replace(/\/$/, "");
    } catch {
        return configuredApiUrl;
    }
})();

const axiosClient = axios.create({
    baseURL: apiUrl,
    headers: {
        "Content-Type": "application/json"
    }
});

axiosClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && !error.config?.url?.includes("/auth/login")) {
            clearSession();
            window.location.assign("/login");
        }
        return Promise.reject(error);
    }
);

export default axiosClient;
