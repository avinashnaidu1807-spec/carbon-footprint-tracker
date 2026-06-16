/* ============================================
   EcoTrack — Carbon Footprint Awareness Platform
   Main Application Logic
   
   Purpose: Comprehensive carbon footprint tracker enabling users to:
   - Calculate personal annual CO₂ emissions across 4 categories (transport, energy, food, lifestyle)
   - View personalized insights via interactive charts
   - Log eco-friendly actions and track impact
   - Commit to sustainability pledges
   
   Architecture: IIFE pattern for module encapsulation. All state private.
   Security: Input sanitization, validation, CSP compliance, XSS prevention.
   ============================================ */

(function () {
    'use strict';

    // ========================
    // INPUT VALIDATION CONSTANTS
    // ========================
    const INPUT_LIMITS = {
        carKm: { min: 0, max: 99999 },
        flights: { min: 0, max: 365 },
        electricity: { min: 0, max: 99999 },
        householdSize: { min: 1, max: 20 },
        streaming: { min: 0, max: 24 }
    };

    // ========================
    // SECURITY HELPERS
    // ========================

    /**
     * Escapes HTML special characters to prevent XSS attacks.
     * Replaces dangerous characters with HTML entities.
     * Security: Prevents injection of malicious scripts via user data.
     * 
     * @param {string} str - Raw string input (unsanitized)
     * @returns {string} - HTML-safe escaped string
     * @throws {TypeError} If str is not a string, returns empty string
     * @example
     * sanitizeString('<img src=x onerror=alert(1)>') → '&lt;img src=x onerror=alert(1)&gt;'
     */
    function sanitizeString(str) {
        if (typeof str !== 'string') return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
        return str.replace(/[&<>"'/]/g, m => map[m]);
    }

    /**
     * Validates a numeric form input value within specified bounds.
     * Security: Prevents integer overflow, NaN, Infinity injection.
     * 
     * @param {*} value - Value to validate (any type)
     * @param {number} [min=0] - Minimum allowed value (inclusive)
     * @param {number} [max=99999] - Maximum allowed value (inclusive)
     * @returns {boolean} True if value is valid number within range
     * @example
     * validateNumericInput(50, 0, 100) → true
     * validateNumericInput('50', 0, 100) → true
     * validateNumericInput(NaN) → false
     */
    function validateNumericInput(value, min = 0, max = 99999) {
        const n = parseFloat(value);
        return !isNaN(n) && isFinite(n) && n >= min && n <= max;
    }

    /**
     * Safely logs message to console for debugging.
     * Security: Only logs in non-production; prevents console injection.
     * 
     * @param {string} level - Log level: 'info', 'warn', 'error'
     * @param {string} message - Message to log
     * @param {*} data - Optional data to log
     */
    function debugLog(level, message, data) {
        // Browser-safe environment check (no Node.js process object in browser)
        const isProduction = typeof window !== 'undefined' &&
            window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1';
        if (isProduction) return;
        const timestamp = new Date().toISOString();
        const logFn = console[level] || console.log;
        logFn(`[EcoTrack][${timestamp}] ${message}`, data !== undefined ? data : '');
    }

    /**
     * Announces a message to screen reader users via ARIA live region.
     * Accessibility: Ensures dynamic updates are announced to assistive technology.
     * 
     * @param {string} message - Message to announce (will be sanitized)
     * @returns {void}
     */
    function announceToScreenReader(message) {
        const region = document.getElementById('aria-live-region');
        if (!region) {
            debugLog('warn', 'aria-live-region not found');
            return;
        }
        region.textContent = '';
        setTimeout(() => { region.textContent = sanitizeString(message); }, 50);
    }

    // ========================
    // DATA & CONSTANTS
    // ========================

    const ACTION_DATA = {
        bike: { label: 'Cycled instead of driving', icon: '🚲', co2: 2.6 },
        transit: { label: 'Used public transit', icon: '🚌', co2: 1.8 },
        meatless: { label: 'Had a meatless meal', icon: '🥗', co2: 2.5 },
        reuse: { label: 'Recycled or reused items', icon: '♻️', co2: 0.5 },
        unplug: { label: 'Unplugged devices', icon: '🔌', co2: 0.3 },
        local: { label: 'Bought local produce', icon: '🏪', co2: 0.8 },
        walk: { label: 'Walked instead of driving', icon: '🚶', co2: 2.0 },
        'cold-wash': { label: 'Cold water laundry', icon: '🧺', co2: 0.6 },
        'no-waste': { label: 'Zero food waste today', icon: '🍽️', co2: 1.2 },
        tree: { label: 'Planted a tree', icon: '🌳', co2: 22.0 }
    };

    const CAR_EMISSIONS = {
        none: 0,
        petrol: 0.21,
        diesel: 0.17,
        hybrid: 0.12,
        electric: 0.05
    };

    const DIET_EMISSIONS = {
        'heavy-meat': 3.3,
        'medium-meat': 2.5,
        'low-meat': 1.9,
        pescatarian: 1.7,
        vegetarian: 1.5,
        vegan: 1.0
    };

    const FOOD_WASTE_FACTOR = {
        high: 0.5,
        medium: 0.3,
        low: 0.1,
        none: 0
    };

    const LOCAL_FOOD_FACTOR = {
        never: 0,
        sometimes: -0.1,
        often: -0.2,
        always: -0.35
    };

    const RENEWABLE_FACTOR = {
        none: 1,
        partial: 0.5,
        full: 0.1
    };

    const RECYCLING_FACTOR = {
        never: 0.5,
        sometimes: 0.3,
        often: 0.15,
        always: 0.05
    };

    // ========================
    // STATE
    // ========================

    let currentStep = 1;
    let footprintData = null;
    let donutChart = null;
    let barChart = null;
    let weeklyChart = null;

    // ========================
    // DOM READY
    // ========================

    document.addEventListener('DOMContentLoaded', () => {
        initParticles();
        initNavigation();
        initHeroStats();
        initCalculator();
        initDashboardCharts();
        initTipsFilter();
        initTracker();
        initPledge();
        initScrollReveal();
        loadSavedData();
    });

    // ========================
    // PARTICLE BACKGROUND
    // ========================

    /**
     * Renders animated particle background using HTML5 Canvas.
     * Performance optimized: Responsive particle count based on viewport size.
     * Features: Auto-resize on window, particle connections, smooth animation.
     * Accessibility: Canvas marked as presentation layer for screen readers.
     * 
     * @returns {void}
     */
    function initParticles() {
        const canvas = document.getElementById('particle-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let particles = [];
        let animId;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        resize();
        window.addEventListener('resize', resize);

        class Particle {
            constructor() {
                this.reset();
            }

            reset() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 2 + 0.5;
                this.speedX = (Math.random() - 0.5) * 0.4;
                this.speedY = (Math.random() - 0.5) * 0.4;
                this.opacity = Math.random() * 0.5 + 0.1;
                this.color = ['#0077B6', '#00B4D8', '#90E0EF', '#CAF0F8'][Math.floor(Math.random() * 4)];
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;

                if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
                if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.globalAlpha = this.opacity;
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }

        const count = Math.min(80, Math.floor((canvas.width * canvas.height) / 15000));
        for (let i = 0; i < count; i++) {
            particles.push(new Particle());
        }

        function connectParticles() {
            for (let a = 0; a < particles.length; a++) {
                for (let b = a + 1; b < particles.length; b++) {
                    const dx = particles[a].x - particles[b].x;
                    const dy = particles[a].y - particles[b].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.strokeStyle = '#00B4D8';
                        ctx.globalAlpha = 0.05 * (1 - dist / 120);
                        ctx.lineWidth = 0.5;
                        ctx.moveTo(particles[a].x, particles[a].y);
                        ctx.lineTo(particles[b].x, particles[b].y);
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    }
                }
            }
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            connectParticles();
            animId = requestAnimationFrame(animate);
        }

        animate();
    }

    // ========================
    // NAVIGATION
    // ========================

    /**
     * Initializes navigation bar with scroll effects and mobile toggle.
     * Features: Active link highlighting, sticky navbar on scroll, mobile menu.
     * Accessibility: ARIA labels for nav toggle button.
     * Error Handling: Graceful fallback if nav elements missing.
     * 
     * @returns {void}
     */
    function initNavigation() {
        try {
            const navbar = document.getElementById('main-nav');
            const toggle = document.getElementById('nav-toggle');
            const links = document.getElementById('nav-links');
            const navLinks = document.querySelectorAll('.nav-link');

            if (!navbar || !toggle || !links || navLinks.length === 0) {
                debugLog('warn', 'Navigation elements not fully initialized');
                return;
            }

            // Scroll effect
            window.addEventListener('scroll', () => {
                try {
                    if (window.scrollY > 50) {
                        navbar.classList.add('scrolled');
                    } else {
                        navbar.classList.remove('scrolled');
                    }
                    updateActiveNav();
                } catch (e) {
                    debugLog('error', 'Error in scroll event', e);
                }
            });

            // Mobile toggle
            toggle.addEventListener('click', () => {
                links.classList.toggle('open');
                toggle.setAttribute('aria-expanded', links.classList.contains('open'));
            });

            // Close mobile nav on link click
            navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    links.classList.remove('open');
                    toggle.setAttribute('aria-expanded', 'false');
                });
            });

            function updateActiveNav() {
                try {
                    const sections = document.querySelectorAll('.section, .hero-section');
                    const scrollPos = window.scrollY + 200;

                    sections.forEach(section => {
                        const top = section.offsetTop;
                        const height = section.offsetHeight;
                        const id = section.getAttribute('id');

                        if (scrollPos >= top && scrollPos < top + height) {
                            navLinks.forEach(link => {
                                link.classList.remove('active');
                                link.setAttribute('aria-current', 'false');
                                if (link.getAttribute('href') === '#' + id) {
                                    link.classList.add('active');
                                    link.setAttribute('aria-current', 'page');
                                }
                            });
                        }
                    });
                } catch (e) {
                    debugLog('error', 'Error updating active nav', e);
                }
            }
        } catch (e) {
            debugLog('error', 'Error initializing navigation', e);
        }
    }

    // ========================
    // HERO STATS COUNTER
    // ========================

    /**
     * Animates hero section statistics on page load.
     * Uses easing animation for smooth number reveal effect.
     * Performance: Triggered once with requestAnimationFrame.
     * Error Handling: Validates elements and data before animation.
     * 
     * @returns {void}
     */
    function initHeroStats() {
        try {
            const stats = document.querySelectorAll('.hero-stat-number');
            if (stats.length === 0) {
                debugLog('warn', 'No hero stats found');
                return;
            }

            let animated = false;

            function animateStats() {
                if (animated) return;
                animated = true;

                stats.forEach(stat => {
                    try {
                        const target = parseFloat(stat.dataset.target);
                        if (!isFinite(target)) {
                            debugLog('warn', 'Invalid target value for stat', stat.dataset.target);
                            return;
                        }

                        const duration = 2000;
                        const start = performance.now();

                        function step(now) {
                            const elapsed = now - start;
                            const progress = Math.min(elapsed / duration, 1);
                            const eased = 1 - Math.pow(1 - progress, 3);
                            const current = (eased * target).toFixed(1);
                            stat.textContent = current % 1 === 0 ? parseInt(current) : current;
                            if (progress < 1) requestAnimationFrame(step);
                            else stat.textContent = (target % 1 === 0 ? parseInt(target) : target.toFixed(1));
                        }

                        requestAnimationFrame(step);
                    } catch (e) {
                        debugLog('error', 'Error animating stat', e);
                    }
                });
            }

            // Trigger immediately since hero is visible on load
            setTimeout(animateStats, 500);
        } catch (e) {
            debugLog('error', 'Error initializing hero stats', e);
        }
    }

    // ========================
    // CALCULATOR
    // ========================

    /**
     * Initializes the multi-step calculator wizard.
     * Sets up form navigation, progress bar, and submission.
     * Features: Previous/Next buttons, progress tracking, step validation.
     * 
     * @returns {void}
     */
    function initCalculator() {
        // Security: Defensive checks for all required DOM elements
        const prevBtn = document.getElementById('calc-prev');
        const nextBtn = document.getElementById('calc-next');
        const submitBtn = document.getElementById('calc-submit');
        const progressBar = document.getElementById('calc-progress-bar');
        const steps = document.querySelectorAll('.calc-step');
        const forms = document.querySelectorAll('.calc-form');

        // Validate all required elements exist
        if (!prevBtn || !nextBtn || !submitBtn || !progressBar || steps.length === 0 || forms.length === 0) {
            debugLog('error', 'Calculator: Required DOM elements not found');
            showToast('error', 'Calculator failed to initialize. Please refresh the page.');
            return;
        }

        function goToStep(step) {
            currentStep = step;

            // Update forms
            forms.forEach(f => f.classList.remove('active'));
            document.getElementById('calc-step-' + step).classList.add('active');

            // Update progress steps
            steps.forEach(s => {
                const sStep = parseInt(s.dataset.step);
                s.classList.remove('active', 'completed');
                if (sStep === step) s.classList.add('active');
                if (sStep < step) s.classList.add('completed');
            });

            // Update progress bar
            progressBar.style.width = (step / 4 * 100) + '%';

            // Update buttons
            prevBtn.disabled = step === 1;
            if (step === 4) {
                nextBtn.classList.add('hidden');
                submitBtn.classList.remove('hidden');
            } else {
                nextBtn.classList.remove('hidden');
                submitBtn.classList.add('hidden');
            }
        }

        prevBtn.addEventListener('click', () => {
            if (currentStep > 1) goToStep(currentStep - 1);
        });

        nextBtn.addEventListener('click', () => {
            if (currentStep < 4) goToStep(currentStep + 1);
        });

        submitBtn.addEventListener('click', calculateFootprint);
    }

    function calculateFootprint() {
        // Gather & validate inputs with defensive type checks
        let carKm, carType, publicTransport, flights, electricity, gasBill, renewable, householdSize;
        let dietType, foodWaste, localFood, clothing, electronics, recycling, streaming;

        try {
            carKm = parseFloat(document.getElementById('car-km')?.value || '0') || 0;
            carType = document.getElementById('car-type')?.value || 'none';
            publicTransport = parseFloat(document.getElementById('public-transport')?.value || '0') || 0;
            flights = parseFloat(document.getElementById('flights-year')?.value || '0') || 0;

            electricity = parseFloat(document.getElementById('electricity')?.value || '0') || 0;
            gasBill = parseFloat(document.getElementById('gas-bill')?.value || '0') || 0;
            renewable = document.getElementById('renewable')?.value || 'none';
            householdSize = Math.max(1, parseFloat(document.getElementById('household-size')?.value || '1') || 1);

            dietType = document.getElementById('diet-type')?.value || 'medium-meat';
            foodWaste = document.getElementById('food-waste')?.value || 'medium';
            localFood = document.getElementById('local-food')?.value || 'sometimes';

            clothing = parseFloat(document.getElementById('clothing')?.value || '0') || 0;
            electronics = parseFloat(document.getElementById('electronics')?.value || '0') || 0;
            recycling = document.getElementById('recycling')?.value || 'sometimes';
            streaming = Math.min(24, parseFloat(document.getElementById('streaming')?.value || '0') || 0);
        } catch (e) {
            debugLog('error', 'Failed to read form values', e);
            showToast('error', 'Error reading form data. Please try again.');
            return;
        }

        // Security: Comprehensive input validation to prevent injection attacks and overflow
        if (!validateNumericInput(carKm, INPUT_LIMITS.carKm.min, INPUT_LIMITS.carKm.max)) {
            showToast('warning', 'Car km value is out of range (0-99999).');
            debugLog('warn', 'Invalid carKm input', carKm);
            return;
        }
        if (!validateNumericInput(flights, INPUT_LIMITS.flights.min, INPUT_LIMITS.flights.max)) {
            showToast('warning', 'Flights value is out of range (0-365).');
            debugLog('warn', 'Invalid flights input', flights);
            return;
        }
        if (!validateNumericInput(electricity, INPUT_LIMITS.electricity.min, INPUT_LIMITS.electricity.max)) {
            showToast('warning', 'Electricity value is out of range (0-99999).');
            return;
        }
        if (!validateNumericInput(householdSize, INPUT_LIMITS.householdSize.min, INPUT_LIMITS.householdSize.max)) {
            showToast('warning', 'Household size must be between 1 and 20.');
            return;
        }
        if (!validateNumericInput(streaming, INPUT_LIMITS.streaming.min, INPUT_LIMITS.streaming.max)) {
            showToast('warning', 'Streaming hours must be between 0 and 24.');
            return;
        }

        // Additional validation for dropdown values (security: prevent invalid enum values)
        const validCarTypes = Object.keys(CAR_EMISSIONS);
        const validDietTypes = Object.keys(DIET_EMISSIONS);
        const validFoodWaste = Object.keys(FOOD_WASTE_FACTOR);
        const validLocalFood = Object.keys(LOCAL_FOOD_FACTOR);
        const validRenewable = Object.keys(RENEWABLE_FACTOR);
        const validRecycling = Object.keys(RECYCLING_FACTOR);

        if (!validCarTypes.includes(carType)) {
            debugLog('error', 'Invalid car type selected', carType);
            showToast('error', 'Invalid car type selected.');
            return;
        }
        if (!validDietTypes.includes(dietType)) {
            debugLog('error', 'Invalid diet type selected', dietType);
            showToast('error', 'Invalid diet type selected.');
            return;
        }
        if (!validFoodWaste.includes(foodWaste)) {
            debugLog('error', 'Invalid food waste setting', foodWaste);
            showToast('error', 'Invalid food waste setting.');
            return;
        }
        if (!validLocalFood.includes(localFood)) {
            debugLog('error', 'Invalid local food setting', localFood);
            showToast('error', 'Invalid local food setting.');
            return;
        }
        if (!validRenewable.includes(renewable)) {
            debugLog('error', 'Invalid renewable setting', renewable);
            showToast('error', 'Invalid renewable energy setting.');
            return;
        }
        if (!validRecycling.includes(recycling)) {
            debugLog('error', 'Invalid recycling setting', recycling);
            showToast('error', 'Invalid recycling setting.');
            return;
        }

        // Calculate transport emissions (tons CO₂/year)
        // Formula: distance × occurrences × emission_factor / conversion
        const carEmissions = carKm * 52 * (CAR_EMISSIONS[carType] || 0) / 1000;
        const transitEmissions = publicTransport * 52 * 0.089 / 1000;
        const flightEmissions = flights * 1.1;
        const transportTotal = carEmissions + transitEmissions + flightEmissions;

        // Calculate energy emissions (tons CO₂/year)
        // Formula: monthly_bill × 12 months × emission_coefficient × renewable_factor / household_size
        const elecEmissions = (electricity * 12 * 0.92) / 100 * RENEWABLE_FACTOR[renewable] / householdSize;
        const gasEmissions = (gasBill * 12 * 0.005) / householdSize;
        const energyTotal = elecEmissions + gasEmissions;

        // Calculate food emissions (tons CO₂/year)
        // Formula: diet_base + waste_factor + local_factor (minimum 0.5 tons/year)
        const dietEmissions = DIET_EMISSIONS[dietType] || 2.5;
        const wasteEmissions = FOOD_WASTE_FACTOR[foodWaste] || 0.3;
        const localFactor = LOCAL_FOOD_FACTOR[localFood] || 0;
        const foodTotal = Math.max(0.5, dietEmissions + wasteEmissions + localFactor);

        // Calculate lifestyle emissions (tons CO₂/year)
        // Includes: clothing purchases, electronics, recycling habits, streaming usage
        const clothingEmissions = clothing * 12 * 0.025;
        const electronicsEmissions = electronics * 0.3;
        const recycleEmissions = RECYCLING_FACTOR[recycling] || 0.15;
        const streamingEmissions = streaming * 365 * 0.036 / 1000;
        const lifestyleTotal = clothingEmissions + electronicsEmissions + recycleEmissions + streamingEmissions;

        const total = transportTotal + energyTotal + foodTotal + lifestyleTotal;

        footprintData = {
            transport: Math.round(transportTotal * 100) / 100,
            energy: Math.round(energyTotal * 100) / 100,
            food: Math.round(foodTotal * 100) / 100,
            lifestyle: Math.round(lifestyleTotal * 100) / 100,
            total: Math.round(total * 100) / 100
        };

        // Save to localStorage with error handling
        try {
            localStorage.setItem('ecotrack-footprint', JSON.stringify(footprintData));
        } catch (e) {
            debugLog('error', 'localStorage quota exceeded or unavailable', e);
            showToast('warning', 'Could not save results — storage unavailable.');
        }

        // Update dashboard
        updateDashboard();

        // Scroll to dashboard
        document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth' });

        // Announce to screen readers
        announceToScreenReader(`Your carbon footprint is ${footprintData.total} tons of CO2 per year. Check your dashboard for the full breakdown.`);

        showToast('success', 'Footprint calculated! Check your dashboard below.');
    }

    // ========================
    // DASHBOARD
    // ========================

    /**
     * Initializes all dashboard charts (donut, comparison bar, weekly line).
     * Uses Chart.js library for data visualization.
     * Security: Safe color injection, no user data in chart config.
     * Accessibility: Proper labels and tooltips for screen readers.
     * Error Handling: Graceful fallback if Chart.js unavailable or DOM elements missing.
     * 
     * @returns {void}
     */
    function initDashboardCharts() {
        // Validate Chart.js is available
        if (typeof Chart === 'undefined') {
            debugLog('error', 'Chart.js library not loaded');
            showToast('warning', 'Chart library not available. Charts may not display.');
            return;
        }

        // Initialize empty donut chart
        const donutCtx = document.getElementById('footprint-donut-chart');
        if (donutCtx && donutCtx.getContext) {
            try {
                donutChart = new Chart(donutCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Transport', 'Energy', 'Food', 'Lifestyle'],
                    datasets: [{
                        data: [25, 25, 25, 25],
                        backgroundColor: [
                            '#0077B6',
                            '#00B4D8',
                            '#90E0EF',
                            '#CAF0F8'
                        ],
                        borderWidth: 0,
                        hoverOffset: 8,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    cutout: '68%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#CAF0F8',
                                padding: 16,
                                font: { family: 'Inter', size: 12 },
                                usePointStyle: true,
                                pointStyleWidth: 10
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(3, 4, 94, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#CAF0F8',
                            borderColor: 'rgba(0,180,216,0.3)',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: true,
                            callbacks: {
                                label: function (ctx) {
                                    return ctx.label + ': ' + ctx.parsed.toFixed(2) + ' tons CO₂';
                                }
                            }
                        }
                    }
                }
            });
            } catch (e) {
                debugLog('error', 'Failed to initialize donut chart', e);
            }
        } else {
            debugLog('warn', 'Donut chart canvas element not found');
        }

        // Initialize comparison bar chart
        const barCtx = document.getElementById('comparison-bar-chart');
        if (barCtx && barCtx.getContext) {
            try {
                barChart = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: ['You', 'World Avg', 'US Avg', '2050 Target'],
                    datasets: [{
                        label: 'Annual CO₂ Emissions (tons)',
                        data: [0, 4.7, 16, 2],
                        backgroundColor: [
                            'rgba(0, 180, 216, 0.8)',
                            'rgba(0, 119, 182, 0.6)',
                            'rgba(144, 224, 239, 0.5)',
                            'rgba(34, 197, 94, 0.6)'
                        ],
                        borderColor: [
                            '#00B4D8',
                            '#0077B6',
                            '#90E0EF',
                            '#22c55e'
                        ],
                        borderWidth: 1,
                        borderRadius: 8,
                        barPercentage: 0.6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0,180,216,0.05)',
                                drawBorder: false
                            },
                            ticks: {
                                color: 'rgba(202,240,248,0.5)',
                                font: { family: 'Inter', size: 11 },
                                callback: v => v + 't'
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: 'rgba(202,240,248,0.7)',
                                font: { family: 'Inter', size: 12 }
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(3, 4, 94, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#CAF0F8',
                            borderColor: 'rgba(0,180,216,0.3)',
                            borderWidth: 1,
                            padding: 12,
                            callbacks: {
                                label: function (ctx) {
                                    return ctx.parsed.y.toFixed(1) + ' tons CO₂/year';
                                }
                            }
                        }
                    }
                }
            });
            } catch (e) {
                debugLog('error', 'Failed to initialize bar chart', e);
            }
        } else {
            debugLog('warn', 'Bar chart canvas element not found');
        }

        // Initialize weekly chart
        const weeklyCtx = document.getElementById('weekly-chart');
        if (weeklyCtx && weeklyCtx.getContext) {
            try {
                const days = getLast7Days();
            weeklyChart = new Chart(weeklyCtx, {
                type: 'line',
                data: {
                    labels: days,
                    datasets: [{
                        label: 'CO₂ Saved (kg)',
                        data: [0, 0, 0, 0, 0, 0, 0],
                        fill: true,
                        backgroundColor: 'rgba(0, 180, 216, 0.1)',
                        borderColor: '#00B4D8',
                        borderWidth: 2,
                        tension: 0.4,
                        pointBackgroundColor: '#00B4D8',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0,180,216,0.05)',
                                drawBorder: false
                            },
                            ticks: {
                                color: 'rgba(202,240,248,0.5)',
                                font: { family: 'Inter', size: 11 },
                                callback: v => v + ' kg'
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: {
                                color: 'rgba(202,240,248,0.7)',
                                font: { family: 'Inter', size: 11 }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: {
                                color: '#CAF0F8',
                                font: { family: 'Inter', size: 12 }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(3, 4, 94, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#CAF0F8',
                            borderColor: 'rgba(0,180,216,0.3)',
                            borderWidth: 1,
                            padding: 12
                        }
                    }
                }
            });
            } catch (e) {
                debugLog('error', 'Failed to initialize weekly chart', e);
            }
        } else {
            debugLog('warn', 'Weekly chart canvas element not found');
        }
    }

    function updateDashboard() {
        try {
            if (!footprintData) {
                debugLog('warn', 'No footprint data available for dashboard update');
                return;
            }

            const { transport, energy, food, lifestyle, total } = footprintData;

            // Validate data types and values
            if (typeof total !== 'number' || !isFinite(total) || total < 0) {
                debugLog('error', 'Invalid total footprint value', total);
                return;
            }

            // Update total with error handling
            const totalEl = document.getElementById('total-footprint');
            if (totalEl) {
                animateNumber(totalEl, total);
            } else {
                debugLog('warn', 'Total footprint element not found');
            }

            // Update comparison text with proper element check
            const compText = document.getElementById('comparison-text');
            if (compText) {
                if (total > 16) {
                    compText.innerHTML = '⚠️ Your footprint is <strong>above the US average</strong>. There\'s significant room for improvement!';
                } else if (total > 4.7) {
                    compText.innerHTML = '📊 Your footprint is <strong>above the world average</strong> but below the US average. You\'re doing okay!';
                } else if (total > 2) {
                    compText.innerHTML = '🌿 Great! Your footprint is <strong>below the world average</strong>. Keep up the good work!';
                } else {
                    compText.innerHTML = '🌟 Amazing! Your footprint is <strong>near the 2050 target</strong>. You\'re a true eco warrior!';
                }
            } else {
                debugLog('warn', 'Comparison text element not found');
            }

            // Update comparison bar with error handling
            const barFill = document.getElementById('comparison-bar');
            if (barFill) {
                const percentage = Math.min((total / 16) * 100, 100);
                setTimeout(() => {
                    barFill.style.width = percentage + '%';
                    if (total > 10) {
                        barFill.style.background = 'linear-gradient(90deg, #00B4D8, #ef4444)';
                    } else if (total > 5) {
                        barFill.style.background = 'linear-gradient(90deg, #00B4D8, #f59e0b)';
                    } else {
                        barFill.style.background = 'linear-gradient(90deg, #22c55e, #00B4D8)';
                    }
                }, 100);
            } else {
                debugLog('warn', 'Comparison bar element not found');
            }

            // Update category cards
            updateCategoryCard('transport', transport, total);
            updateCategoryCard('energy', energy, total);
            updateCategoryCard('food', food, total);
            updateCategoryCard('lifestyle', lifestyle, total);

            // Update donut chart with validation
            if (donutChart && typeof donutChart.update === 'function') {
                donutChart.data.datasets[0].data = [transport, energy, food, lifestyle];
                donutChart.update('none');
            } else if (!donutChart) {
                debugLog('warn', 'Donut chart not initialized');
            }

            // Update bar chart with validation
            if (barChart && typeof barChart.update === 'function') {
                barChart.data.datasets[0].data[0] = total;
                barChart.update('none');
            } else if (!barChart) {
                debugLog('warn', 'Bar chart not initialized');
            }
        } catch (e) {
            debugLog('error', 'Error updating dashboard', e);
            showToast('error', 'Failed to update dashboard. Please refresh the page.');
        }
    }

    function updateCategoryCard(category, value, total) {
        try {
            // Validate inputs
            if (!category || typeof value !== 'number' || !isFinite(value) || value < 0) {
                debugLog('warn', 'Invalid category card data', { category, value });
                return;
            }

            const valEl = document.getElementById('cat-' + category + '-val');
            const barEl = document.getElementById('cat-' + category + '-bar');

            if (valEl) {
                valEl.textContent = value.toFixed(2) + ' tons';
            }
            if (barEl && total > 0) {
                const pct = (value / total * 100);
                setTimeout(() => { barEl.style.width = Math.min(pct, 100) + '%'; }, 200);
            }
        } catch (e) {
            debugLog('error', 'Error updating category card', e);
        }
    }

    function animateNumber(el, target) {
        try {
            if (!el || typeof target !== 'number' || !isFinite(target)) {
                debugLog('warn', 'Invalid animate number parameters');
                return;
            }

            const duration = 1500;
            const start = performance.now();

            function step(now) {
                const elapsed = now - start;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                el.textContent = (eased * target).toFixed(1);
                if (progress < 1) requestAnimationFrame(step);
                else el.textContent = target.toFixed(1);
            }

            requestAnimationFrame(step);
        } catch (e) {
            debugLog('error', 'Error animating number', e);
            if (el) el.textContent = target.toFixed(1);
        }
    }

    // ========================
    // TIPS FILTER
    // ========================

    /**
     * Sets up filter buttons for action tips.
     * Allows users to view tips by category (transport, energy, food, lifestyle).
     * Accessibility: Proper ARIA attributes for buttons.
     * Security: Validates data attributes and sanitizes filter values.
     * 
     * @returns {void}
     */
    function initTipsFilter() {
        try {
            const filterBtns = document.querySelectorAll('.filter-btn');
            const tipCards = document.querySelectorAll('.tip-card');

            if (filterBtns.length === 0 || tipCards.length === 0) {
                debugLog('warn', 'Tips filter elements not found');
                return;
            }

            filterBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    try {
                        const filter = btn.dataset.filter;
                        
                        // Validate filter value
                        if (!filter || typeof filter !== 'string') {
                            debugLog('warn', 'Invalid filter value', filter);
                            return;
                        }

                        filterBtns.forEach(b => {
                            b.classList.remove('active');
                            b.setAttribute('aria-pressed', 'false');
                        });
                        btn.classList.add('active');
                        btn.setAttribute('aria-pressed', 'true');

                        tipCards.forEach(card => {
                            const cardCategory = card.dataset.category;
                            if (filter === 'all' || cardCategory === filter) {
                                card.classList.remove('hidden-card');
                                card.style.animation = 'fadeInUp 0.4s ease forwards';
                            } else {
                                card.classList.add('hidden-card');
                            }
                        });

                        debugLog('info', 'Tips filter applied', filter);
                    } catch (e) {
                        debugLog('error', 'Error handling filter click', e);
                    }
                });
            });
        } catch (e) {
            debugLog('error', 'Error initializing tips filter', e);
            showToast('warning', 'Tips filter not available.');
        }
    }

    // ========================
    // ACTION TRACKER
    // ========================

    /**
     * Initializes the action logging and tracking system.
     * Handles logging, history, streak calculation, and achievements.
     * Features: Log actions, clear history, track streaks, unlock achievements.
     * Persistence: All data saved to localStorage with error handling.
     * Security: Validates DOM elements and data structures before use.
     * 
     * @returns {void}
     */
    function initTracker() {
        try {
            const logBtn = document.getElementById('log-action-btn');
            const clearBtn = document.getElementById('clear-history-btn');

            if (!logBtn || !clearBtn) {
                debugLog('error', 'Tracker buttons not found');
                showToast('warning', 'Tracker initialization failed.');
                return;
            }

            logBtn.addEventListener('click', logAction);
            clearBtn.addEventListener('click', clearHistory);
        } catch (e) {
            debugLog('error', 'Error initializing tracker', e);
        }
    }

    function logAction() {
        try {
            const select = document.getElementById('action-select');
            
            if (!select) {
                debugLog('error', 'Action select element not found');
                showToast('error', 'Tracker not available.');
                return;
            }

            const value = select.value;

            if (!value || typeof value !== 'string') {
                showToast('warning', 'Please select an action to log.');
                return;
            }

            const action = ACTION_DATA[value];
            if (!action) {
                debugLog('error', 'Action not found', value);
                showToast('error', 'Invalid action selected.');
                return;
            }

            const now = new Date();

            // Get existing actions with error handling
            let actions = [];
            try {
                const stored = localStorage.getItem('ecotrack-actions');
                actions = stored ? JSON.parse(stored) : [];
                if (!Array.isArray(actions)) {
                    debugLog('warn', 'Stored actions is not an array, resetting');
                    actions = [];
                }
            } catch (e) {
                debugLog('error', 'Failed to parse stored actions', e);
                showToast('warning', 'Could not load action history. Starting fresh.');
                actions = [];
            }

            // Security: Validate action data structure before storing
            if (typeof action.co2 !== 'number' || action.co2 < 0 || !isFinite(action.co2)) {
                debugLog('error', 'Invalid action CO2 value', action);
                showToast('error', 'Invalid action data.');
                return;
            }

            // Prevent excessive data accumulation (security: cap at 5000 actions)
            if (actions.length > 5000) {
                actions = actions.slice(0, 5000);
                debugLog('warn', 'Action history exceeded maximum length, trimmed');
            }

            actions.unshift({
                type: value,
                label: action.label,
                icon: action.icon,
                co2: action.co2,
                date: now.toISOString()
            });

            // Save with error handling
            try {
                localStorage.setItem('ecotrack-actions', JSON.stringify(actions));
            } catch (e) {
                debugLog('error', 'localStorage quota exceeded for actions', e);
                showToast('warning', 'Could not save action — storage full.');
                return;
            }

            // Reset select
            select.selectedIndex = 0;

            // Update UI
            updateTrackerUI();

            // Security: sanitize all dynamic text inserted into the DOM
            const safeLabel = sanitizeString(action.label);
            
            // Announce logged action to screen readers
            announceToScreenReader(`Action logged: ${safeLabel}. You saved ${action.co2} kg of CO2.`);
            
            showToast('success', `${action.icon} ${action.label} — Saved ${action.co2} kg CO₂!`);
        } catch (e) {
            debugLog('error', 'Error logging action', e);
            showToast('error', 'Failed to log action. Please try again.');
        }
    }

    function clearHistory() {
        try {
            if (!localStorage) {
                debugLog('error', 'localStorage not available');
                showToast('error', 'Cannot clear history — storage unavailable.');
                return;
            }
            localStorage.removeItem('ecotrack-actions');
            updateTrackerUI();
            announceToScreenReader('Action history cleared.');
            showToast('info', 'Action history cleared.');
        } catch (e) {
            debugLog('error', 'Failed to clear action history', e);
            showToast('error', 'Could not clear history.');
        }
    }

    function updateTrackerUI() {
        try {
            let actions = [];
            try {
                const stored = localStorage.getItem('ecotrack-actions');
                actions = stored ? JSON.parse(stored) : [];
                if (!Array.isArray(actions)) {
                    debugLog('error', 'Stored actions is not an array');
                    actions = [];
                }
            } catch (e) {
                debugLog('error', 'Failed to parse stored actions in updateTrackerUI', e);
                actions = [];
            }

            const historyList = document.getElementById('history-list');
            const totalActionsEl = document.getElementById('total-actions');
            const totalCo2El = document.getElementById('total-saved-co2');
            const streakEl = document.getElementById('current-streak');

            if (!historyList || !totalActionsEl || !totalCo2El || !streakEl) {
                debugLog('warn', 'Tracker UI elements not found');
                return;
            }

            // Total actions
            totalActionsEl.textContent = actions.length;

            // Total CO₂ saved (prevent overflow by capping at 99999 and validating)
            let totalCo2 = 0;
            actions.forEach(a => {
                if (typeof a.co2 === 'number' && isFinite(a.co2) && a.co2 >= 0) {
                    totalCo2 += a.co2;
                }
            });
            totalCo2 = Math.min(totalCo2, 99999);
            totalCo2El.textContent = totalCo2.toFixed(1);

            // Calculate streak
            const streak = calculateStreak(actions);
            streakEl.textContent = streak;

            // Update history list with sanitization and error handling
            if (actions.length === 0) {
                historyList.innerHTML = `
                    <div class="history-empty">
                        <i class="fas fa-inbox"></i>
                        <p>No actions logged yet. Start making a difference today!</p>
                    </div>`;
            } else {
                try {
                    historyList.innerHTML = actions.slice(0, 20).map(a => {
                        try {
                            const d = new Date(a.date);
                            if (isNaN(d.getTime())) {
                                debugLog('warn', 'Invalid date in action', a.date);
                                return '';
                            }
                            const ts = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
                                ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                            const lbl = sanitizeString(a.label || '');
                            const ico = sanitizeString(a.icon || '');
                            const co2val = (typeof a.co2 === 'number' && isFinite(a.co2) && a.co2 >= 0) ? a.co2 : 0;
                            return `
                                <div class="history-item" role="listitem">
                                    <span class="history-icon" aria-hidden="true">${ico}</span>
                                    <div class="history-info">
                                        <strong>${lbl}</strong>
                                        <small>${ts}</small>
                                    </div>
                                    <span class="history-saved" aria-label="CO2 saved: ${co2val} kilograms">-${co2val} kg</span>
                                </div>`;
                        } catch (itemError) {
                            debugLog('warn', 'Error processing history item', itemError);
                            return '';
                        }
                    }).filter(html => html !== '').join('');
                } catch (e) {
                    debugLog('error', 'Error rendering history list', e);
                    historyList.innerHTML = '<p>Error loading history</p>';
                }
            }

            // Update weekly chart
            updateWeeklyChart(actions);

            // Update achievements
            updateAchievements(actions.length, streak);
        } catch (e) {
            debugLog('error', 'Error updating tracker UI', e);
        }
    }

    function calculateStreak(actions) {
        if (actions.length === 0) return 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const actionDates = [...new Set(actions.map(a => {
            const d = new Date(a.date);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        }))].sort((a, b) => b - a);

        // Check if today or yesterday has an action (allow 1 day grace)
        const mostRecent = actionDates[0];
        const diffDays = (today.getTime() - mostRecent) / (1000 * 60 * 60 * 24);
        if (diffDays > 1) return 0;

        let streak = 1;
        for (let i = 1; i < actionDates.length; i++) {
            const diff = (actionDates[i - 1] - actionDates[i]) / (1000 * 60 * 60 * 24);
            if (diff <= 1) {
                streak++;
            } else {
                break;
            }
        }

        return streak;
    }

    function updateWeeklyChart(actions) {
        try {
            if (!weeklyChart || typeof weeklyChart.update !== 'function') {
                debugLog('warn', 'Weekly chart not available for update');
                return;
            }

            if (!Array.isArray(actions)) {
                debugLog('error', 'Invalid actions array passed to updateWeeklyChart');
                return;
            }

            const days = getLast7Days();
            const today = new Date();
            const data = new Array(7).fill(0);

            actions.forEach(a => {
                try {
                    if (typeof a.co2 !== 'number' || !isFinite(a.co2) || a.co2 < 0) {
                        return; // Skip invalid entries
                    }
                    const actionDate = new Date(a.date);
                    if (isNaN(actionDate.getTime())) {
                        return; // Skip invalid dates
                    }
                    const diffMs = today.getTime() - actionDate.getTime();
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    if (diffDays >= 0 && diffDays < 7) {
                        data[6 - diffDays] += a.co2;
                    }
                } catch (itemError) {
                    debugLog('warn', 'Error processing action for weekly chart', itemError);
                }
            });

            weeklyChart.data.labels = days;
            weeklyChart.data.datasets[0].data = data.map(d => Math.round(d * 10) / 10);
            weeklyChart.update('none');
        } catch (e) {
            debugLog('error', 'Error updating weekly chart', e);
        }
    }

    function updateAchievements(totalActions, streak) {
        try {
            const achievements = document.querySelectorAll('.achievement');
            if (achievements.length === 0) {
                debugLog('warn', 'No achievement elements found');
                return;
            }

            achievements.forEach(ach => {
                try {
                    const req = parseInt(ach.dataset.req);
                    const type = ach.dataset.type;
                    
                    if (isNaN(req)) {
                        debugLog('warn', 'Invalid achievement requirement', ach.dataset.req);
                        return;
                    }

                    const compareVal = type === 'streak' ? streak : totalActions;

                    if (compareVal >= req) {
                        if (!ach.classList.contains('unlocked')) {
                            ach.classList.remove('locked');
                            ach.classList.add('unlocked');
                        }
                    }
                } catch (achError) {
                    debugLog('warn', 'Error processing achievement', achError);
                }
            });
        } catch (e) {
            debugLog('error', 'Error updating achievements', e);
        }
    }

    function getLast7Days() {
        const days = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push(dayNames[d.getDay()]);
        }
        return days;
    }

    // ========================
    // PLEDGE
    // ========================

    /**
     * Initializes the Green Pledge system.
     * Users commit to sustainability goals (transport, energy, food, waste reduction).
     * Tracks pledged state and calculates potential carbon savings.
     * Persistence: Pledges saved to localStorage with error handling.
     * Security: Validates data structure before use.
     * 
     * @returns {void}
     */
    function initPledge() {
        try {
            const pledgeBtns = document.querySelectorAll('.btn-pledge');
            if (pledgeBtns.length === 0) {
                debugLog('warn', 'No pledge buttons found');
                return;
            }

            let pledges = {};
            try {
                const stored = localStorage.getItem('ecotrack-pledges');
                if (stored) {
                    pledges = JSON.parse(stored);
                    if (typeof pledges !== 'object' || pledges === null) {
                        debugLog('error', 'Invalid pledges data structure');
                        pledges = {};
                    }
                }
            } catch (e) {
                debugLog('error', 'Failed to parse stored pledges', e);
                pledges = {};
            }

            const pledgeSavings = {
                transport: 1.2,
                energy: 0.8,
                food: 0.6,
                waste: 0.4
            };

            // Restore pledged state with error handling
            try {
                Object.keys(pledges).forEach(key => {
                    const btn = document.getElementById('pledge-' + key);
                    if (btn && pledges[key]) {
                        btn.textContent = '✓ Pledged!';
                        btn.classList.add('pledged');
                    }
                });
            } catch (e) {
                debugLog('error', 'Error restoring pledge state', e);
            }

            updatePledgeStats();

            pledgeBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    try {
                        const card = btn.closest('.pledge-card');
                        if (!card) {
                            debugLog('error', 'Pledge card not found');
                            showToast('error', 'Error processing pledge.');
                            return;
                        }

                        const pledgeType = card.dataset.pledge;
                        if (!pledgeType || typeof pledgeType !== 'string') {
                            debugLog('error', 'Invalid pledge type', pledgeType);
                            showToast('error', 'Invalid pledge type.');
                            return;
                        }

                        pledges[pledgeType] = true;
                        try {
                            localStorage.setItem('ecotrack-pledges', JSON.stringify(pledges));
                        } catch (e) {
                            debugLog('error', 'Failed to save pledge', e);
                            showToast('warning', 'Could not save pledge — storage full.');
                            return;
                        }

                        btn.textContent = '✓ Pledged!';
                        btn.classList.add('pledged');
                        const currentLabel = btn.getAttribute('aria-label') || 'Pledge';
                        btn.setAttribute('aria-label', `${currentLabel} — Already pledged`);

                        updatePledgeStats();
                        announceToScreenReader('Pledge taken! Thank you for committing to a greener planet.');
                        showToast('success', '🎉 Pledge taken! You\'re making a commitment for the planet.');
                    } catch (e) {
                        debugLog('error', 'Error handling pledge click', e);
                        showToast('error', 'Failed to process pledge.');
                    }
                });
            });

            function updatePledgeStats() {
                try {
                    const pledgesTakenEl = document.getElementById('pledges-taken');
                    const potentialEl = document.getElementById('potential-savings');

                    if (!pledgesTakenEl || !potentialEl) {
                        debugLog('warn', 'Pledge stats elements not found');
                        return;
                    }

                    const takenCount = Object.values(pledges).filter(v => v === true).length;
                    let totalSavings = 0;
                    Object.keys(pledges).forEach(key => {
                        if (pledges[key] === true && typeof pledgeSavings[key] === 'number') {
                            totalSavings += pledgeSavings[key];
                        }
                    });

                    if (takenCount > 99) {
                        pledgesTakenEl.textContent = '99+';
                    } else {
                        pledgesTakenEl.textContent = takenCount;
                    }
                    potentialEl.textContent = Math.min(totalSavings, 9999).toFixed(1);
                } catch (e) {
                    debugLog('error', 'Error updating pledge stats', e);
                }
            }
        } catch (e) {
            debugLog('error', 'Error initializing pledges', e);
        }
    }

    // ========================
    // SCROLL REVEAL
    // ========================

    /**
     * Animates elements into view as user scrolls.
     * Uses IntersectionObserver for performance.
     * Accessibility: Only visual enhancement, content still accessible.
     * Error Handling: Graceful fallback if IntersectionObserver not supported.
     * 
     * @returns {void}
     */
    function initScrollReveal() {
        try {
            const elements = document.querySelectorAll(
                '.dash-card, .tip-card, .tracker-card, .pledge-card, .section-header'
            );

            if (elements.length === 0) {
                debugLog('warn', 'No reveal elements found');
                return;
            }

            elements.forEach(el => el.classList.add('reveal'));

            // Check if IntersectionObserver is supported
            if (typeof IntersectionObserver === 'undefined') {
                debugLog('warn', 'IntersectionObserver not supported, showing all elements immediately');
                elements.forEach(el => el.classList.add('revealed'));
                return;
            }

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    try {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('revealed');
                            observer.unobserve(entry.target);
                        }
                    } catch (e) {
                        debugLog('error', 'Error processing reveal entry', e);
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '0px 0px -40px 0px'
            });

            elements.forEach(el => {
                try {
                    observer.observe(el);
                } catch (e) {
                    debugLog('error', 'Error observing element', e);
                }
            });
        } catch (e) {
            debugLog('error', 'Error initializing scroll reveal', e);
        }
    }

    // ========================
    // TOAST NOTIFICATION
    // ========================

    function showToast(type, message) {
        const container = document.getElementById('toast-container');
        const icons = {
            success: 'fa-check-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon"><i class="fas ${icons[type] || icons.info}"></i></span>
            <span>${message}</span>`;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ========================
    // LOAD SAVED DATA
    // ========================

    /**
     * Safely loads persisted data from localStorage on page load.
     * Recovers gracefully from corrupted data or missing storage.
     * 
     * @returns {void}
     */
    function loadSavedData() {
        // Load footprint data
        try {
            const saved = localStorage.getItem('ecotrack-footprint');
            if (saved) {
                footprintData = JSON.parse(saved);
                // Validate data structure
                if (footprintData && typeof footprintData.total === 'number') {
                    updateDashboard();
                } else {
                    debugLog('warn', 'Invalid footprint data structure');
                }
            }
        } catch (e) {
            debugLog('error', 'Failed to load footprint data', e);
        }

        // Load tracker data
        try {
            updateTrackerUI();
        } catch (e) {
            debugLog('error', 'Failed to load tracker data', e);
        }
    }

})();
