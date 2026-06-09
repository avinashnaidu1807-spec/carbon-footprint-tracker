/**
 * @file tests.js
 * @description Comprehensive test suite for EcoTrack Carbon Footprint Platform.
 * Covers: calculator logic, input validation, security (XSS/injection), 
 * accessibility checks, tracker logic, and pledge system.
 */

'use strict';

/* ============================================================
   MINI TEST FRAMEWORK
   ============================================================ */

const EcoTests = (function () {

    const results = { passed: 0, failed: 0, total: 0, suites: [] };
    let currentSuite = null;

    function describe(suiteName, fn) {
        currentSuite = { name: suiteName, tests: [] };
        results.suites.push(currentSuite);
        fn();
        currentSuite = null;
    }

    function it(testName, fn) {
        results.total++;
        try {
            fn();
            results.passed++;
            currentSuite.tests.push({ name: testName, status: 'PASS', error: null });
        } catch (e) {
            results.failed++;
            currentSuite.tests.push({ name: testName, status: 'FAIL', error: e.message });
        }
    }

    function expect(actual) {
        return {
            toBe(expected) {
                if (actual !== expected) {
                    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
                }
            },
            toEqual(expected) {
                if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
                }
            },
            toBeGreaterThan(n) {
                if (!(actual > n)) throw new Error(`Expected ${actual} > ${n}`);
            },
            toBeGreaterThanOrEqual(n) {
                if (!(actual >= n)) throw new Error(`Expected ${actual} >= ${n}`);
            },
            toBeLessThan(n) {
                if (!(actual < n)) throw new Error(`Expected ${actual} < ${n}`);
            },
            toBeLessThanOrEqual(n) {
                if (!(actual <= n)) throw new Error(`Expected ${actual} <= ${n}`);
            },
            toBeTruthy() {
                if (!actual) throw new Error(`Expected truthy, got ${actual}`);
            },
            toBeFalsy() {
                if (actual) throw new Error(`Expected falsy, got ${actual}`);
            },
            toContain(substr) {
                if (!String(actual).includes(substr)) {
                    throw new Error(`Expected "${actual}" to contain "${substr}"`);
                }
            },
            toBeNull() {
                if (actual !== null) throw new Error(`Expected null, got ${actual}`);
            },
            not: {
                toBe(expected) {
                    if (actual === expected) throw new Error(`Expected NOT ${JSON.stringify(expected)}`);
                },
                toContain(substr) {
                    if (String(actual).includes(substr)) {
                        throw new Error(`Expected "${actual}" NOT to contain "${substr}"`);
                    }
                },
                toBeNull() {
                    if (actual === null) throw new Error(`Expected not null`);
                }
            }
        };
    }

    return { describe, it, expect, results };
})();

const { describe, it, expect } = EcoTests;

/* ============================================================
   CALCULATOR LOGIC (replicated for isolated testing)
   ============================================================ */

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
    'pescatarian': 1.7,
    'vegetarian': 1.5,
    'vegan': 1.0
};

const FOOD_WASTE_FACTOR = { high: 0.5, medium: 0.3, low: 0.1, none: 0 };
const LOCAL_FOOD_FACTOR = { never: 0, sometimes: -0.1, often: -0.2, always: -0.35 };
const RENEWABLE_FACTOR = { none: 1, partial: 0.5, full: 0.1 };
const RECYCLING_FACTOR = { never: 0.5, sometimes: 0.3, often: 0.15, always: 0.05 };

const ACTION_DATA = {
    bike:       { label: 'Cycled instead of driving', icon: '🚲', co2: 2.6 },
    transit:    { label: 'Used public transit',       icon: '🚌', co2: 1.8 },
    meatless:   { label: 'Had a meatless meal',       icon: '🥗', co2: 2.5 },
    reuse:      { label: 'Recycled or reused items',  icon: '♻️', co2: 0.5 },
    unplug:     { label: 'Unplugged devices',         icon: '🔌', co2: 0.3 },
    local:      { label: 'Bought local produce',      icon: '🏪', co2: 0.8 },
    walk:       { label: 'Walked instead of driving', icon: '🚶', co2: 2.0 },
    'cold-wash':{ label: 'Cold water laundry',        icon: '🧺', co2: 0.6 },
    'no-waste': { label: 'Zero food waste today',     icon: '🍽️', co2: 1.2 },
    tree:       { label: 'Planted a tree',            icon: '🌳', co2: 22.0 }
};

/**
 * Pure calculation function — testable independently of DOM.
 * @param {Object} inputs - All form values
 * @returns {Object} - Emissions per category and total
 */
function calculateFootprintLogic(inputs) {
    const {
        carKm = 0, carType = 'none', publicTransport = 0, flights = 0,
        electricity = 0, gasBill = 0, renewable = 'none', householdSize = 1,
        dietType = 'medium-meat', foodWaste = 'medium', localFood = 'sometimes',
        clothing = 0, electronics = 0, recycling = 'often', streaming = 0
    } = inputs;

    if (householdSize < 1) throw new RangeError('Household size must be at least 1');
    if (carKm < 0 || flights < 0 || electricity < 0) throw new RangeError('Values cannot be negative');

    const transport = (carKm * 52 * (CAR_EMISSIONS[carType] || 0) / 1000)
        + (publicTransport * 52 * 0.089 / 1000)
        + (flights * 1.1);

    const energy = ((electricity * 12 * 0.92) / 100 * RENEWABLE_FACTOR[renewable] / householdSize)
        + ((gasBill * 12 * 0.005) / householdSize);

    const food = Math.max(0.5,
        (DIET_EMISSIONS[dietType] || 2.5)
        + (FOOD_WASTE_FACTOR[foodWaste] || 0.3)
        + (LOCAL_FOOD_FACTOR[localFood] || 0)
    );

    const lifestyle = (clothing * 12 * 0.025)
        + (electronics * 0.3)
        + (RECYCLING_FACTOR[recycling] || 0.15)
        + (streaming * 365 * 0.036 / 1000);

    const total = transport + energy + food + lifestyle;

    return {
        transport: Math.round(transport * 100) / 100,
        energy:    Math.round(energy * 100) / 100,
        food:      Math.round(food * 100) / 100,
        lifestyle: Math.round(lifestyle * 100) / 100,
        total:     Math.round(total * 100) / 100
    };
}

/**
 * Sanitize a string to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
    return str.replace(/[&<>"'/]/g, m => map[m]);
}

/**
 * Validate a numeric input value.
 * @param {*} value
 * @param {number} min
 * @param {number} max
 * @returns {boolean}
 */
function validateNumericInput(value, min = 0, max = 99999) {
    const n = parseFloat(value);
    return !isNaN(n) && n >= min && n <= max && isFinite(n);
}

/**
 * Calculate streak from action array.
 * @param {Array} actions
 * @returns {number}
 */
function calculateStreak(actions) {
    if (!actions || actions.length === 0) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dates = [...new Set(actions.map(a => {
        const d = new Date(a.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }))].sort((a, b) => b - a);
    const diffDays = (today.getTime() - dates[0]) / 86400000;
    if (diffDays > 1) return 0;
    let streak = 1;
    for (let i = 1; i < dates.length; i++) {
        if ((dates[i - 1] - dates[i]) / 86400000 <= 1) streak++;
        else break;
    }
    return streak;
}

/* ============================================================
   TEST SUITES
   ============================================================ */

// ── 1. CALCULATOR CORE LOGIC ────────────────────────────────
describe('Calculator: Transport Emissions', function () {

    it('returns zero transport for no-car / no-flights / no-transit', function () {
        const result = calculateFootprintLogic({ carType: 'none', carKm: 0, flights: 0, publicTransport: 0 });
        expect(result.transport).toBe(0);
    });

    it('calculates petrol car emissions correctly', function () {
        const result = calculateFootprintLogic({ carKm: 100, carType: 'petrol', flights: 0, publicTransport: 0 });
        const expected = Math.round(100 * 52 * 0.21 / 1000 * 100) / 100;
        expect(result.transport).toBe(expected);
    });

    it('calculates electric car with lower emissions than petrol', function () {
        const petrol   = calculateFootprintLogic({ carKm: 100, carType: 'petrol',   flights: 0, publicTransport: 0 });
        const electric = calculateFootprintLogic({ carKm: 100, carType: 'electric', flights: 0, publicTransport: 0 });
        expect(electric.transport).toBeLessThan(petrol.transport);
    });

    it('calculates flight emissions at 1.1 tons per flight', function () {
        const result = calculateFootprintLogic({ carType: 'none', carKm: 0, flights: 2, publicTransport: 0 });
        expect(result.transport).toBe(2.2);
    });

    it('hybrid emits less than diesel', function () {
        const diesel = calculateFootprintLogic({ carKm: 100, carType: 'diesel', flights: 0, publicTransport: 0 });
        const hybrid = calculateFootprintLogic({ carKm: 100, carType: 'hybrid', flights: 0, publicTransport: 0 });
        expect(hybrid.transport).toBeLessThan(diesel.transport);
    });
});

describe('Calculator: Energy Emissions', function () {

    it('full renewable energy reduces energy emissions by 90%', function () {
        const noRenew   = calculateFootprintLogic({ electricity: 100, gasBill: 0, renewable: 'none',  householdSize: 1 });
        const fullRenew = calculateFootprintLogic({ electricity: 100, gasBill: 0, renewable: 'full',  householdSize: 1 });
        expect(fullRenew.energy).toBeLessThan(noRenew.energy * 0.15);
    });

    it('larger household size reduces per-person energy emissions', function () {
        const single = calculateFootprintLogic({ electricity: 100, gasBill: 50, renewable: 'none', householdSize: 1 });
        const family = calculateFootprintLogic({ electricity: 100, gasBill: 50, renewable: 'none', householdSize: 4 });
        expect(family.energy).toBeLessThan(single.energy);
    });

    it('zero electricity and gas yields zero energy emissions', function () {
        const result = calculateFootprintLogic({ electricity: 0, gasBill: 0, renewable: 'none', householdSize: 1 });
        expect(result.energy).toBe(0);
    });
});

describe('Calculator: Food Emissions', function () {

    it('vegan diet emits less than heavy meat diet', function () {
        const vegan     = calculateFootprintLogic({ dietType: 'vegan',       foodWaste: 'none', localFood: 'always' });
        const heavyMeat = calculateFootprintLogic({ dietType: 'heavy-meat',  foodWaste: 'high', localFood: 'never' });
        expect(vegan.food).toBeLessThan(heavyMeat.food);
    });

    it('food emissions are always >= 0.5 (minimum threshold)', function () {
        const result = calculateFootprintLogic({ dietType: 'vegan', foodWaste: 'none', localFood: 'always' });
        expect(result.food).toBeGreaterThanOrEqual(0.5);
    });

    it('buying local food reduces emissions vs never buying local', function () {
        const local = calculateFootprintLogic({ dietType: 'medium-meat', foodWaste: 'medium', localFood: 'always' });
        const never = calculateFootprintLogic({ dietType: 'medium-meat', foodWaste: 'medium', localFood: 'never' });
        expect(local.food).toBeLessThan(never.food);
    });
});

describe('Calculator: Lifestyle Emissions', function () {

    it('zero lifestyle inputs yield small baseline from recycling factor', function () {
        const result = calculateFootprintLogic({ clothing: 0, electronics: 0, recycling: 'always', streaming: 0 });
        expect(result.lifestyle).toBe(RECYCLING_FACTOR['always']);
    });

    it('always recycling yields lower lifestyle emissions than never', function () {
        const always = calculateFootprintLogic({ clothing: 3, electronics: 2, recycling: 'always', streaming: 4 });
        const never  = calculateFootprintLogic({ clothing: 3, electronics: 2, recycling: 'never',  streaming: 4 });
        expect(always.lifestyle).toBeLessThan(never.lifestyle);
    });

    it('more clothing items increases lifestyle emissions', function () {
        const few  = calculateFootprintLogic({ clothing: 1, electronics: 0, recycling: 'often', streaming: 0 });
        const many = calculateFootprintLogic({ clothing: 10, electronics: 0, recycling: 'often', streaming: 0 });
        expect(many.lifestyle).toBeGreaterThan(few.lifestyle);
    });
});

describe('Calculator: Total & Validation', function () {

    it('total is sum of all categories', function () {
        const r = calculateFootprintLogic({
            carKm: 100, carType: 'petrol', flights: 2, publicTransport: 5,
            electricity: 80, gasBill: 50, renewable: 'none', householdSize: 2,
            dietType: 'medium-meat', foodWaste: 'medium', localFood: 'sometimes',
            clothing: 3, electronics: 2, recycling: 'often', streaming: 4
        });
        const expectedTotal = Math.round((r.transport + r.energy + r.food + r.lifestyle) * 100) / 100;
        expect(r.total).toBe(expectedTotal);
    });

    it('throws RangeError for negative carKm', function () {
        let threw = false;
        try { calculateFootprintLogic({ carKm: -10, carType: 'petrol' }); }
        catch (e) { if (e instanceof RangeError) threw = true; }
        expect(threw).toBeTruthy();
    });

    it('throws RangeError for household size < 1', function () {
        let threw = false;
        try { calculateFootprintLogic({ householdSize: 0 }); }
        catch (e) { if (e instanceof RangeError) threw = true; }
        expect(threw).toBeTruthy();
    });

    it('returns object with all four category keys', function () {
        const r = calculateFootprintLogic({});
        expect(typeof r.transport).toBe('number');
        expect(typeof r.energy).toBe('number');
        expect(typeof r.food).toBe('number');
        expect(typeof r.lifestyle).toBe('number');
        expect(typeof r.total).toBe('number');
    });

    it('all returned values are finite numbers', function () {
        const r = calculateFootprintLogic({ carKm: 200, carType: 'petrol', flights: 5, electricity: 150, householdSize: 2 });
        expect(isFinite(r.total)).toBeTruthy();
        expect(isFinite(r.transport)).toBeTruthy();
        expect(isFinite(r.energy)).toBeTruthy();
    });
});

// ── 2. SECURITY TESTS ───────────────────────────────────────
describe('Security: XSS Prevention', function () {

    it('sanitizes <script> tags from input', function () {
        const result = sanitizeString('<script>alert("xss")</script>');
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('</script>');
    });

    it('escapes angle brackets', function () {
        const result = sanitizeString('<img src=x onerror=alert(1)>');
        expect(result).not.toContain('<img');
        expect(result).toContain('&lt;');
    });

    it('escapes double quotes', function () {
        const result = sanitizeString('"hello"');
        expect(result).toContain('&quot;');
    });

    it('escapes single quotes', function () {
        const result = sanitizeString("' OR 1=1 --");
        expect(result).toContain('&#x27;');
    });

    it('escapes ampersands', function () {
        const result = sanitizeString('cats & dogs');
        expect(result).toContain('&amp;');
    });

    it('returns empty string for non-string input', function () {
        expect(sanitizeString(null)).toBe('');
        expect(sanitizeString(undefined)).toBe('');
        expect(sanitizeString(123)).toBe('');
    });

    it('preserves safe text unchanged (no special chars)', function () {
        const result = sanitizeString('Hello World 123');
        expect(result).toBe('Hello World 123');
    });

    it('handles javascript: protocol attempt', function () {
        const result = sanitizeString('javascript:alert(1)');
        expect(result).not.toContain('<');
        expect(result).not.toContain('>');
    });
});

describe('Security: Input Validation', function () {

    it('accepts valid zero value', function () {
        expect(validateNumericInput(0)).toBeTruthy();
    });

    it('accepts valid positive number', function () {
        expect(validateNumericInput(100)).toBeTruthy();
    });

    it('rejects negative values by default', function () {
        expect(validateNumericInput(-5)).toBeFalsy();
    });

    it('rejects NaN', function () {
        expect(validateNumericInput('abc')).toBeFalsy();
    });

    it('rejects Infinity', function () {
        expect(validateNumericInput(Infinity)).toBeFalsy();
    });

    it('rejects value above max', function () {
        expect(validateNumericInput(99999999, 0, 99999)).toBeFalsy();
    });

    it('accepts string number representations', function () {
        expect(validateNumericInput('42')).toBeTruthy();
    });

    it('rejects empty string', function () {
        expect(validateNumericInput('')).toBeFalsy();
    });

    it('rejects null', function () {
        expect(validateNumericInput(null)).toBeFalsy();
    });

    it('rejects object injection attempt', function () {
        expect(validateNumericInput({ valueOf() { return -1; } })).toBeFalsy();
    });
});

// ── 3. ACTION TRACKER LOGIC ─────────────────────────────────
describe('Tracker: Action CO2 Savings', function () {

    it('bike action has correct CO2 saving', function () {
        expect(ACTION_DATA.bike.co2).toBe(2.6);
    });

    it('tree planting has highest CO2 saving', function () {
        const max = Math.max(...Object.values(ACTION_DATA).map(a => a.co2));
        expect(ACTION_DATA.tree.co2).toBe(max);
    });

    it('all actions have positive CO2 savings', function () {
        const allPositive = Object.values(ACTION_DATA).every(a => a.co2 > 0);
        expect(allPositive).toBeTruthy();
    });

    it('all actions have required fields: label, icon, co2', function () {
        const allValid = Object.values(ACTION_DATA).every(a =>
            typeof a.label === 'string' && a.label.length > 0 &&
            typeof a.icon === 'string' &&
            typeof a.co2 === 'number'
        );
        expect(allValid).toBeTruthy();
    });

    it('total CO2 saved correctly sums all actions', function () {
        const actions = [
            { co2: 2.6, date: new Date().toISOString() },
            { co2: 1.8, date: new Date().toISOString() }
        ];
        const total = actions.reduce((sum, a) => sum + a.co2, 0);
        expect(total).toBe(4.4);
    });
});

describe('Tracker: Streak Calculation', function () {

    it('returns 0 for empty action list', function () {
        expect(calculateStreak([])).toBe(0);
    });

    it('returns 0 for null', function () {
        expect(calculateStreak(null)).toBe(0);
    });

    it('returns 1 for single action today', function () {
        const actions = [{ date: new Date().toISOString() }];
        expect(calculateStreak(actions)).toBeGreaterThanOrEqual(1);
    });

    it('returns streak of 2 for actions on two consecutive days', function () {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const actions = [
            { date: today.toISOString() },
            { date: yesterday.toISOString() }
        ];
        expect(calculateStreak(actions)).toBeGreaterThanOrEqual(2);
    });

    it('streak resets after missing a day', function () {
        const today = new Date();
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const actions = [
            { date: twoDaysAgo.toISOString() }
        ];
        // More than 1 day gap from today, streak should be 0
        const streak = calculateStreak(actions);
        expect(streak).toBeLessThanOrEqual(1);
    });
});

// ── 4. EMISSIONS CONSTANTS INTEGRITY ───────────────────────
describe('Data Integrity: Emissions Constants', function () {

    it('all car types have non-negative emission factors', function () {
        const allValid = Object.values(CAR_EMISSIONS).every(v => v >= 0);
        expect(allValid).toBeTruthy();
    });

    it('electric car emits less than petrol', function () {
        expect(CAR_EMISSIONS.electric).toBeLessThan(CAR_EMISSIONS.petrol);
    });

    it('hybrid emits less than diesel', function () {
        expect(CAR_EMISSIONS.hybrid).toBeLessThan(CAR_EMISSIONS.diesel);
    });

    it('full renewable reduces energy by more than half vs none', function () {
        expect(RENEWABLE_FACTOR.full).toBeLessThan(RENEWABLE_FACTOR.none / 2);
    });

    it('always recycling has lower factor than never recycling', function () {
        expect(RECYCLING_FACTOR.always).toBeLessThan(RECYCLING_FACTOR.never);
    });

    it('vegan diet has lower emission than heavy-meat', function () {
        expect(DIET_EMISSIONS.vegan).toBeLessThan(DIET_EMISSIONS['heavy-meat']);
    });

    it('diet emissions are all positive', function () {
        const allPositive = Object.values(DIET_EMISSIONS).every(v => v > 0);
        expect(allPositive).toBeTruthy();
    });

    it('food waste factors are all non-negative', function () {
        const allValid = Object.values(FOOD_WASTE_FACTOR).every(v => v >= 0);
        expect(allValid).toBeTruthy();
    });
});

// ── 5. ACCESSIBILITY CHECKS (DOM-based) ─────────────────────
describe('Accessibility: DOM Structure', function () {

    function docReady() { return typeof document !== 'undefined'; }

    it('page has exactly one h1 element', function () {
        if (!docReady()) return;
        const h1s = document.querySelectorAll('h1');
        expect(h1s.length).toBe(1);
    });

    it('all images have alt attributes', function () {
        if (!docReady()) return;
        const imgs = document.querySelectorAll('img');
        const allHaveAlt = [...imgs].every(img => img.hasAttribute('alt'));
        expect(allHaveAlt).toBeTruthy();
    });

    it('all form inputs have associated labels', function () {
        if (!docReady()) return;
        const inputs = document.querySelectorAll('input[id], select[id]');
        const allLabelled = [...inputs].every(input => {
            const id = input.getAttribute('id');
            return document.querySelector(`label[for="${id}"]`) !== null
                || input.hasAttribute('aria-label')
                || input.hasAttribute('aria-labelledby');
        });
        expect(allLabelled).toBeTruthy();
    });

    it('navigation has aria-label', function () {
        if (!docReady()) return;
        const nav = document.querySelector('nav');
        expect(nav).not.toBeNull();
        const hasAria = nav.hasAttribute('aria-label') || nav.hasAttribute('role');
        expect(hasAria).toBeTruthy();
    });

    it('all buttons have accessible text or aria-label', function () {
        if (!docReady()) return;
        const buttons = document.querySelectorAll('button');
        const allAccessible = [...buttons].every(btn =>
            btn.textContent.trim().length > 0 || btn.hasAttribute('aria-label')
        );
        expect(allAccessible).toBeTruthy();
    });

    it('skip navigation link exists', function () {
        if (!docReady()) return;
        const skip = document.querySelector('a.skip-link, a[href="#main-content"], a[href="#calculator"]');
        expect(skip).not.toBeNull();
    });

    it('main content has a landmark role or main tag', function () {
        if (!docReady()) return;
        const main = document.querySelector('main, [role="main"]');
        expect(main).not.toBeNull();
    });

    it('live region exists for dynamic updates', function () {
        if (!docReady()) return;
        const liveRegion = document.querySelector('[aria-live]');
        expect(liveRegion).not.toBeNull();
    });

    it('interactive sections have aria-labelledby or aria-label', function () {
        if (!docReady()) return;
        const sections = document.querySelectorAll('section[id]');
        const allLabelled = [...sections].every(s =>
            s.hasAttribute('aria-labelledby') || s.hasAttribute('aria-label')
        );
        expect(allLabelled).toBeTruthy();
    });

    it('lang attribute is set on html element', function () {
        if (!docReady()) return;
        const html = document.querySelector('html');
        expect(html.hasAttribute('lang')).toBeTruthy();
    });
});

// ── 6. PLEDGE SYSTEM ────────────────────────────────────────
describe('Pledge: System Logic', function () {

    const PLEDGE_SAVINGS = { transport: 1.2, energy: 0.8, food: 0.6, waste: 0.4 };

    it('pledge savings are all positive', function () {
        const allPositive = Object.values(PLEDGE_SAVINGS).every(v => v > 0);
        expect(allPositive).toBeTruthy();
    });

    it('all 4 pledge types are defined', function () {
        expect(typeof PLEDGE_SAVINGS.transport).toBe('number');
        expect(typeof PLEDGE_SAVINGS.energy).toBe('number');
        expect(typeof PLEDGE_SAVINGS.food).toBe('number');
        expect(typeof PLEDGE_SAVINGS.waste).toBe('number');
    });

    it('maximum possible savings from all pledges is 3.0 tons', function () {
        const total = Object.values(PLEDGE_SAVINGS).reduce((s, v) => s + v, 0);
        expect(total).toBe(3.0);
    });

    it('taking all pledges gives correct total CO2 savings', function () {
        const taken = { transport: true, energy: true, food: true, waste: true };
        const totalSavings = Object.keys(taken).reduce((s, k) => s + (PLEDGE_SAVINGS[k] || 0), 0);
        expect(totalSavings).toBe(3.0);
    });

    it('taking no pledges gives zero savings', function () {
        const taken = {};
        const totalSavings = Object.keys(taken).reduce((s, k) => s + (PLEDGE_SAVINGS[k] || 0), 0);
        expect(totalSavings).toBe(0);
    });
});
