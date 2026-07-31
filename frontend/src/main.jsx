import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./style.css";
import SandboxBanner from "./components/SandboxBanner.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SandboxBanner />
    <App />
  </StrictMode>
);
