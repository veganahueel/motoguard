import { $ } from "../core/utils.js";
import { showScreen } from "../core/screens.js";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function onVisible(elements, threshold, callback) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            callback(entry.target);
            observer.unobserve(entry.target);
        });
    }, { threshold });
    elements.forEach((el) => observer.observe(el));
}

function animateCounter(el) {
    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || "";
    if (reducedMotion) { el.textContent = target + suffix; return; }
    const start = performance.now();
    const step = (now) => {
        const progress = Math.min((now - start) / 2400, 1);
        el.textContent = Math.round((1 - (1 - progress) ** 3) * target) + suffix;
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = target + suffix;
    };
    requestAnimationFrame(step);
}

export function initLanding() {
    const go = (screen) => (e) => { e?.preventDefault(); showScreen(screen); };

    $("landing-link-login").addEventListener("click", go("login"));
    ["landing-btn-register", "landing-btn-cta", "landing-btn-cta-footer"]
        .forEach((id) => $(id).addEventListener("click", go("register")));
    ["link-back-to-landing-login", "link-back-to-landing-register"]
        .forEach((id) => $(id).addEventListener("click", go("landing")));
    $("link-to-register").addEventListener("click", go("register"));
    $("link-to-login").addEventListener("click", go("login"));

    onVisible(document.querySelectorAll(".reveal"), 0.15, (el) => el.classList.add("is-visible"));
    onVisible(document.querySelectorAll(".stat-number"), 0.4, animateCounter);
}
