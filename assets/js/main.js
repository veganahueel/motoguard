import { showScreen } from "./core/screens.js";
import { initLanding } from "./features/landing.js";
import { initContact } from "./features/contact.js";
import { initAuth } from "./features/auth.js";
import { startDashboard, stopDashboard } from "./features/dashboard.js";

if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();

initLanding();
initContact();
initAuth({ onLogin: startDashboard, onLogout: stopDashboard });
showScreen("landing");
