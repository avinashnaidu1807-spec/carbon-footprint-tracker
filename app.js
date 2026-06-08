/* ============================================
   EcoTrack — Carbon Footprint Awareness Platform
   Main Application Logic
   ============================================ */

(function () {
    'use strict';

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

    function initNavigation() {
        const navbar = document.getElementById('main-nav');
        const toggle = document.getElementById('nav-toggle');
        const links = document.getElementById('nav-links');
        const navLinks = document.querySelectorAll('.nav-link');

        // Scroll effect
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
            updateActiveNav();
        });

        // Mobile toggle
        toggle.addEventListener('click', () => {
            links.classList.toggle('open');
        });

        // Close mobile nav on link click
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                links.classList.remove('open');
            });
        });

        function updateActiveNav() {
            const sections = document.querySelectorAll('.section, .hero-section');
            const scrollPos = window.scrollY + 200;

            sections.forEach(section => {
                const top = section.offsetTop;
                const height = section.offsetHeight;
                const id = section.getAttribute('id');

                if (scrollPos >= top && scrollPos < top + height) {
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === '#' + id) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        }
    }

    // ========================
    // HERO STATS COUNTER
    // ========================

    function initHeroStats() {
        const stats = document.querySelectorAll('.hero-stat-number');
        let animated = false;

        function animateStats() {
            if (animated) return;
            animated = true;

            stats.forEach(stat => {
                const target = parseFloat(stat.dataset.target);
                const duration = 2000;
                const start = performance.now();

                function step(now) {
                    const elapsed = now - start;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    const current = (eased * target).toFixed(1);
                    stat.textContent = current % 1 === 0 ? parseInt(current) : current;
                    if (progress < 1) requestAnimationFrame(step);
                }

                requestAnimationFrame(step);
            });
        }

        // Trigger immediately since hero is visible on load
        setTimeout(animateStats, 500);
    }

    // ========================
    // CALCULATOR
    // ========================

    function initCalculator() {
        const prevBtn = document.getElementById('calc-prev');
        const nextBtn = document.getElementById('calc-next');
        const submitBtn = document.getElementById('calc-submit');
        const progressBar = document.getElementById('calc-progress-bar');
        const steps = document.querySelectorAll('.calc-step');
        const forms = document.querySelectorAll('.calc-form');

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
        // Gather inputs
        const carKm = parseFloat(document.getElementById('car-km').value) || 0;
        const carType = document.getElementById('car-type').value;
        const publicTransport = parseFloat(document.getElementById('public-transport').value) || 0;
        const flights = parseFloat(document.getElementById('flights-year').value) || 0;

        const electricity = parseFloat(document.getElementById('electricity').value) || 0;
        const gasBill = parseFloat(document.getElementById('gas-bill').value) || 0;
        const renewable = document.getElementById('renewable').value;
        const householdSize = parseFloat(document.getElementById('household-size').value) || 1;

        const dietType = document.getElementById('diet-type').value;
        const foodWaste = document.getElementById('food-waste').value;
        const localFood = document.getElementById('local-food').value;

        const clothing = parseFloat(document.getElementById('clothing').value) || 0;
        const electronics = parseFloat(document.getElementById('electronics').value) || 0;
        const recycling = document.getElementById('recycling').value;
        const streaming = parseFloat(document.getElementById('streaming').value) || 0;

        // Calculate transport emissions (tons CO₂/year)
        const carEmissions = carKm * 52 * (CAR_EMISSIONS[carType] || 0) / 1000;
        const transitEmissions = publicTransport * 52 * 0.089 / 1000;
        const flightEmissions = flights * 1.1;
        const transportTotal = carEmissions + transitEmissions + flightEmissions;

        // Calculate energy emissions (tons CO₂/year)
        const elecEmissions = (electricity * 12 * 0.92) / 100 * RENEWABLE_FACTOR[renewable] / householdSize;
        const gasEmissions = (gasBill * 12 * 0.005) / householdSize;
        const energyTotal = elecEmissions + gasEmissions;

        // Calculate food emissions (tons CO₂/year)
        const dietEmissions = DIET_EMISSIONS[dietType] || 2.5;
        const wasteEmissions = FOOD_WASTE_FACTOR[foodWaste] || 0.3;
        const localFactor = LOCAL_FOOD_FACTOR[localFood] || 0;
        const foodTotal = Math.max(0.5, dietEmissions + wasteEmissions + localFactor);

        // Calculate lifestyle emissions (tons CO₂/year)
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

        // Save to localStorage
        localStorage.setItem('ecotrack-footprint', JSON.stringify(footprintData));

        // Update dashboard
        updateDashboard();

        // Scroll to dashboard
        document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth' });

        showToast('success', 'Footprint calculated! Check your dashboard below.');
    }

    // ========================
    // DASHBOARD
    // ========================

    function initDashboardCharts() {
        // Initialize empty donut chart
        const donutCtx = document.getElementById('footprint-donut-chart');
        if (donutCtx) {
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
        }

        // Initialize comparison bar chart
        const barCtx = document.getElementById('comparison-bar-chart');
        if (barCtx) {
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
        }

        // Initialize weekly chart
        const weeklyCtx = document.getElementById('weekly-chart');
        if (weeklyCtx) {
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
        }
    }

    function updateDashboard() {
        if (!footprintData) return;

        const { transport, energy, food, lifestyle, total } = footprintData;

        // Update total
        const totalEl = document.getElementById('total-footprint');
        animateNumber(totalEl, total);

        // Update comparison text
        const compText = document.getElementById('comparison-text');
        if (total > 16) {
            compText.innerHTML = '⚠️ Your footprint is <strong>above the US average</strong>. There\'s significant room for improvement!';
        } else if (total > 4.7) {
            compText.innerHTML = '📊 Your footprint is <strong>above the world average</strong> but below the US average. You\'re doing okay!';
        } else if (total > 2) {
            compText.innerHTML = '🌿 Great! Your footprint is <strong>below the world average</strong>. Keep up the good work!';
        } else {
            compText.innerHTML = '🌟 Amazing! Your footprint is <strong>near the 2050 target</strong>. You\'re a true eco warrior!';
        }

        // Update comparison bar
        const barFill = document.getElementById('comparison-bar');
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

        // Update category cards
        updateCategoryCard('transport', transport, total);
        updateCategoryCard('energy', energy, total);
        updateCategoryCard('food', food, total);
        updateCategoryCard('lifestyle', lifestyle, total);

        // Update donut chart
        if (donutChart) {
            donutChart.data.datasets[0].data = [transport, energy, food, lifestyle];
            donutChart.update('none');
        }

        // Update bar chart
        if (barChart) {
            barChart.data.datasets[0].data[0] = total;
            barChart.update('none');
        }
    }

    function updateCategoryCard(category, value, total) {
        const valEl = document.getElementById('cat-' + category + '-val');
        const barEl = document.getElementById('cat-' + category + '-bar');

        if (valEl) valEl.textContent = value.toFixed(2) + ' tons';
        if (barEl) {
            const pct = total > 0 ? (value / total * 100) : 0;
            setTimeout(() => { barEl.style.width = pct + '%'; }, 200);
        }
    }

    function animateNumber(el, target) {
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
    }

    // ========================
    // TIPS FILTER
    // ========================

    function initTipsFilter() {
        const filterBtns = document.querySelectorAll('.filter-btn');
        const tipCards = document.querySelectorAll('.tip-card');

        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;

                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                tipCards.forEach(card => {
                    if (filter === 'all' || card.dataset.category === filter) {
                        card.classList.remove('hidden-card');
                        card.style.animation = 'fadeInUp 0.4s ease forwards';
                    } else {
                        card.classList.add('hidden-card');
                    }
                });
            });
        });
    }

    // ========================
    // ACTION TRACKER
    // ========================

    function initTracker() {
        const logBtn = document.getElementById('log-action-btn');
        const clearBtn = document.getElementById('clear-history-btn');

        logBtn.addEventListener('click', logAction);
        clearBtn.addEventListener('click', clearHistory);
    }

    function logAction() {
        const select = document.getElementById('action-select');
        const value = select.value;

        if (!value) {
            showToast('warning', 'Please select an action to log.');
            return;
        }

        const action = ACTION_DATA[value];
        const now = new Date();

        // Get existing actions
        const actions = JSON.parse(localStorage.getItem('ecotrack-actions') || '[]');
        actions.unshift({
            type: value,
            label: action.label,
            icon: action.icon,
            co2: action.co2,
            date: now.toISOString()
        });

        localStorage.setItem('ecotrack-actions', JSON.stringify(actions));

        // Reset select
        select.selectedIndex = 0;

        // Update UI
        updateTrackerUI();
        showToast('success', `${action.icon} ${action.label} — Saved ${action.co2} kg CO₂!`);
    }

    function clearHistory() {
        localStorage.removeItem('ecotrack-actions');
        updateTrackerUI();
        showToast('info', 'Action history cleared.');
    }

    function updateTrackerUI() {
        const actions = JSON.parse(localStorage.getItem('ecotrack-actions') || '[]');
        const historyList = document.getElementById('history-list');
        const totalActionsEl = document.getElementById('total-actions');
        const totalCo2El = document.getElementById('total-saved-co2');
        const streakEl = document.getElementById('current-streak');

        // Total actions
        totalActionsEl.textContent = actions.length;

        // Total CO₂ saved
        const totalCo2 = actions.reduce((sum, a) => sum + a.co2, 0);
        totalCo2El.textContent = totalCo2.toFixed(1);

        // Calculate streak
        const streak = calculateStreak(actions);
        streakEl.textContent = streak;

        // Update history list
        if (actions.length === 0) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <i class="fas fa-inbox"></i>
                    <p>No actions logged yet. Start making a difference today!</p>
                </div>`;
        } else {
            historyList.innerHTML = actions.slice(0, 20).map(a => {
                const date = new Date(a.date);
                const timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
                    ' at ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                return `
                    <div class="history-item">
                        <span class="history-icon">${a.icon}</span>
                        <div class="history-info">
                            <strong>${a.label}</strong>
                            <small>${timeStr}</small>
                        </div>
                        <span class="history-saved">-${a.co2} kg</span>
                    </div>`;
            }).join('');
        }

        // Update weekly chart
        updateWeeklyChart(actions);

        // Update achievements
        updateAchievements(actions.length, streak);
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
        if (!weeklyChart) return;

        const days = getLast7Days();
        const today = new Date();
        const data = new Array(7).fill(0);

        actions.forEach(a => {
            const actionDate = new Date(a.date);
            const diffMs = today.getTime() - actionDate.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays < 7) {
                data[6 - diffDays] += a.co2;
            }
        });

        weeklyChart.data.labels = days;
        weeklyChart.data.datasets[0].data = data.map(d => Math.round(d * 10) / 10);
        weeklyChart.update('none');
    }

    function updateAchievements(totalActions, streak) {
        const achievements = document.querySelectorAll('.achievement');
        achievements.forEach(ach => {
            const req = parseInt(ach.dataset.req);
            const type = ach.dataset.type;
            const compareVal = type === 'streak' ? streak : totalActions;

            if (compareVal >= req) {
                if (!ach.classList.contains('unlocked')) {
                    ach.classList.remove('locked');
                    ach.classList.add('unlocked');
                }
            }
        });
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

    function initPledge() {
        const pledgeBtns = document.querySelectorAll('.btn-pledge');
        const pledges = JSON.parse(localStorage.getItem('ecotrack-pledges') || '{}');

        const pledgeSavings = {
            transport: 1.2,
            energy: 0.8,
            food: 0.6,
            waste: 0.4
        };

        // Restore pledged state
        Object.keys(pledges).forEach(key => {
            const btn = document.getElementById('pledge-' + key);
            if (btn && pledges[key]) {
                btn.textContent = '✓ Pledged!';
                btn.classList.add('pledged');
            }
        });

        updatePledgeStats();

        pledgeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const card = btn.closest('.pledge-card');
                const pledgeType = card.dataset.pledge;

                pledges[pledgeType] = true;
                localStorage.setItem('ecotrack-pledges', JSON.stringify(pledges));

                btn.textContent = '✓ Pledged!';
                btn.classList.add('pledged');

                updatePledgeStats();
                showToast('success', '🎉 Pledge taken! You\'re making a commitment for the planet.');
            });
        });

        function updatePledgeStats() {
            const pledgesTakenEl = document.getElementById('pledges-taken');
            const potentialEl = document.getElementById('potential-savings');

            const takenCount = Object.values(pledges).filter(v => v).length;
            let totalSavings = 0;
            Object.keys(pledges).forEach(key => {
                if (pledges[key] && pledgeSavings[key]) {
                    totalSavings += pledgeSavings[key];
                }
            });

            pledgesTakenEl.textContent = takenCount;
            potentialEl.textContent = totalSavings.toFixed(1);
        }
    }

    // ========================
    // SCROLL REVEAL
    // ========================

    function initScrollReveal() {
        const elements = document.querySelectorAll(
            '.dash-card, .tip-card, .tracker-card, .pledge-card, .section-header'
        );

        elements.forEach(el => el.classList.add('reveal'));

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -40px 0px'
        });

        elements.forEach(el => observer.observe(el));
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

    function loadSavedData() {
        // Load footprint data
        const saved = localStorage.getItem('ecotrack-footprint');
        if (saved) {
            footprintData = JSON.parse(saved);
            updateDashboard();
        }

        // Load tracker data
        updateTrackerUI();
    }

})();
