import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeWebSocketErrorFilter } from "./lib/websocket-error-filter";

// Initialize WebSocket error filtering for development tool conflicts
initializeWebSocketErrorFilter();

createRoot(document.getElementById("root")!).render(<App />);
