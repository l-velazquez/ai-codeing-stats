import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { markPlatform } from "./lib/platform";
import "./styles/index.css";

// Before the first render: the collapsed layout reserves room for the macOS
// traffic lights, which no other platform draws.
markPlatform();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
