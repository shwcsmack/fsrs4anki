// FSRS4Anki v3.9.6 Scheduler Qt6
set_version();
// The latest version will be released on https://github.com/open-spaced-repetition/fsrs4anki

// Default parameters of FSRS4Anki for global
var w = [0.9463, 1.0437, 5.0312, -0.546, -0.5623, 0.1471, 1.3935, -0.0287, 0.7929, 1.9173, -0.2823, 0.4902, 0.9215];
// The above parameters can be optimized via FSRS4Anki optimizer.

// User's custom parameters for global
let requestRetention = 0.9; // recommended setting: 0.8 ~ 0.9
let maximumInterval = 36500;
let easyBonus = 1.3;
let hardInterval = 1.2;
// FSRS only modifies the long-term scheduling. So (re)learning steps in deck options work as usual.
// I recommend not to set steps longer than one day.

// "Fuzz" is a small random delay applied to new intervals to prevent cards from
// sticking together and always coming up for review on the same day
const enable_fuzz = true;

debugger;

// get the name of the card's deck
// need to add <div id=deck deck_name="{{Deck}}"></div> to your card's front template's first line
if (document.getElementById("deck") !== null) {
    const deck_name = document.getElementById("deck").getAttribute("deck_name");
    // parameters for a specific deck
    if (deck_name.startsWith("Korean")) {
        var w = [0.9493, 1.0156, 5.1253, -0.7072, -0.6966, 0.0179, 1.3588, -0.01, 0.7558, 1.7931, -0.4057, 0.3616, 0.8049];
        // User's custom parameters for sub-decks
        requestRetention = 0.9;
        maximumInterval = 36500;
        easyBonus = 1.3;
        hardInterval = 1.2;
    }
}

// auto-calculate intervalModifier
const intervalModifier = Math.log(requestRetention) / Math.log(0.9);
// global fuzz factor for all ratings.
const fuzz_factor = set_fuzz_factor();

const ratings = {
    "again": 1,
    "hard": 2,
    "good": 3,
    "easy": 4
};

// For new cards
if (is_new()) {
    init_states();
    const good_interval = next_interval(customData.good.s);
    const easy_interval = Math.max(next_interval(customData.easy.s * easyBonus), good_interval + 1);
    if (states.good.normal?.review) {
        states.good.normal.review.scheduledDays = good_interval;
    }
    if (states.easy.normal?.review) {
        states.easy.normal.review.scheduledDays = easy_interval;
    }
    // For learning/relearning cards
} else if (is_learning()) {
    // Init states if the card didn't contain customData
    if (is_empty()) {
        init_states();
    }
    const good_interval = next_interval(customData.good.s);
    const easy_interval = Math.max(next_interval(customData.easy.s * easyBonus), good_interval + 1);
    if (states.good.normal?.review) {
        states.good.normal.review.scheduledDays = good_interval;
    }
    if (states.easy.normal?.review) {
        states.easy.normal.review.scheduledDays = easy_interval;
    }
    // For review cards
} else if (is_review()) {
    // Convert the interval and factor to stability and difficulty if the card didn't contain customData
    if (is_empty()) {
        convert_states();
    }
    const interval = states.current.normal?.review.elapsedDays ? states.current.normal.review.elapsedDays : states.current.filtered.rescheduling.originalState.review.elapsedDays;
    const last_d = customData.again.d;
    const last_s = customData.again.s;
    const retrievability = Math.exp(Math.log(0.9) * interval / last_s);
    const lapses = states.again.normal?.relearning.review.lapses ? states.again.normal.relearning.review.lapses : states.again.filtered.rescheduling.originalState.relearning.review.lapses;
    customData.again.d = next_difficulty(last_d, "again");
    customData.again.s = next_forget_stability(customData.again.d, last_s, retrievability);
    customData.hard.d = next_difficulty(last_d, "hard");
    customData.hard.s = next_recall_stability(customData.hard.d, last_s, retrievability);
    customData.good.d = next_difficulty(last_d, "good");
    customData.good.s = next_recall_stability(customData.good.d, last_s, retrievability);
    customData.easy.d = next_difficulty(last_d, "easy");
    customData.easy.s = next_recall_stability(customData.easy.d, last_s, retrievability);
    let hard_interval = next_interval(last_s * hardInterval);
    let good_interval = next_interval(customData.good.s);
    let easy_interval = next_interval(customData.easy.s * easyBonus)
    hard_interval = Math.min(hard_interval, good_interval)
    good_interval = Math.max(good_interval, hard_interval + 1);
    easy_interval = Math.max(easy_interval, good_interval + 1);
    if (states.hard.normal?.review) {
        states.hard.normal.review.scheduledDays = hard_interval;
    }
    if (states.good.normal?.review) {
        states.good.normal.review.scheduledDays = good_interval;
    }
    if (states.easy.normal?.review) {
        states.easy.normal.review.scheduledDays = easy_interval;
    }
}

function constrain_difficulty(difficulty) {
    return Math.min(Math.max(difficulty.toFixed(2), 1), 10);
}

function apply_fuzz(ivl) {
    if (!enable_fuzz || ivl < 2.5) return ivl;
    ivl = Math.round(ivl);
    const min_ivl = Math.max(2, Math.round(ivl * 0.95 - 1));
    const max_ivl = Math.round(ivl * 1.05 + 1);
    return Math.floor(fuzz_factor * (max_ivl - min_ivl + 1) + min_ivl);
}

function next_interval(stability) {
    const new_interval = apply_fuzz(stability * intervalModifier);
    return Math.min(Math.max(Math.round(new_interval), 1), maximumInterval);
}

function next_difficulty(d, rating) {
    let next_d = d + w[4] * (ratings[rating] - 3);
    return constrain_difficulty(mean_reversion(w[2], next_d));
}

function mean_reversion(init, current) {
    return w[5] * init + (1 - w[5]) * current;
}

function next_recall_stability(d, s, r) {
    return +(s * (1 + Math.exp(w[6]) *
        (11 - d) *
        Math.pow(s, w[7]) *
        (Math.exp((1 - r) * w[8]) - 1))).toFixed(2);
}

function next_forget_stability(d, s, r) {
    return +(w[9] * Math.pow(d, w[10]) * Math.pow(
        s, w[11]) * Math.exp((1 - r) * w[12])).toFixed(2);
}

function init_states() {
    customData.again.d = init_difficulty("again");
    customData.again.s = init_stability("again");
    customData.hard.d = init_difficulty("hard");
    customData.hard.s = init_stability("hard");
    customData.good.d = init_difficulty("good");
    customData.good.s = init_stability("good");
    customData.easy.d = init_difficulty("easy");
    customData.easy.s = init_stability("easy");
}

function init_difficulty(rating) {
    return +constrain_difficulty(w[2] + w[3] * (ratings[rating] - 3)).toFixed(2);
}

function init_stability(rating) {
    return +Math.max(w[0] + w[1] * (ratings[rating] - 1), 0.1).toFixed(2);
}

function convert_states() {
    const scheduledDays = states.current.normal ? states.current.normal.review.scheduledDays : states.current.filtered.rescheduling.originalState.review.scheduledDays;
    const easeFactor = states.current.normal ? states.current.normal.review.easeFactor : states.current.filtered.rescheduling.originalState.review.easeFactor;
    const old_s = +Math.max(scheduledDays, 0.1).toFixed(2);
    const old_d = constrain_difficulty(11 - (easeFactor - 1) / (Math.exp(w[6]) * Math.pow(old_s, w[7]) * (Math.exp(0.1 * w[8]) - 1)));
    customData.again.d = old_d;
    customData.again.s = old_s;
    customData.hard.d = old_d;
    customData.hard.s = old_s;
    customData.good.d = old_d;
    customData.good.s = old_s;
    customData.easy.d = old_d;
    customData.easy.s = old_s;
}

function is_new() {
    if (states.current.normal?.new !== undefined) {
        if (states.current.normal?.new !== null) {
            return true;
        }
    }
    if (states.current.filtered?.rescheduling?.originalState !== undefined) {
        if (Object.hasOwn(states.current.filtered?.rescheduling?.originalState, 'new')) {
            return true;
        }
    }
    return false;
}

function is_learning() {
    if (states.current.normal?.learning !== undefined) {
        if (states.current.normal?.learning !== null) {
            return true;
        }
    }
    if (states.current.filtered?.rescheduling?.originalState !== undefined) {
        if (Object.hasOwn(states.current.filtered?.rescheduling?.originalState, 'learning')) {
            return true;
        }
    }
    if (states.current.normal?.relearning !== undefined) {
        if (states.current.normal?.relearning !== null) {
            return true;
        }
    }
    if (states.current.filtered?.rescheduling?.originalState !== undefined) {
        if (Object.hasOwn(states.current.filtered?.rescheduling?.originalState, 'relearning')) {
            return true;
        }
    }
    return false;
}

function is_review() {
    if (states.current.normal?.review !== undefined) {
        if (states.current.normal?.review !== null) {
            return true;
        }
    }
    if (states.current.filtered?.rescheduling?.originalState !== undefined) {
        if (Object.hasOwn(states.current.filtered?.rescheduling?.originalState, 'review')) {
            return true;
        }
    }
    return false;
}

function is_empty() {
    return !customData.again.d | !customData.again.s | !customData.hard.d | !customData.hard.s | !customData.good.d | !customData.good.s | !customData.easy.d | !customData.easy.s;
}

function set_version() {
    const version = "3.9.6";
    customData.again.v = version;
    customData.hard.v = version;
    customData.good.v = version;
    customData.easy.v = version;
}

function set_fuzz_factor() {
    // Note: Originally copied from seedrandom.js package (https://github.com/davidbau/seedrandom)
    !function (f, a, c) { var s, l = 256, p = "random", d = c.pow(l, 6), g = c.pow(2, 52), y = 2 * g, h = l - 1; function n(n, t, r) { function e() { for (var n = u.g(6), t = d, r = 0; n < g;)n = (n + r) * l, t *= l, r = u.g(1); for (; y <= n;)n /= 2, t /= 2, r >>>= 1; return (n + r) / t } var o = [], i = j(function n(t, r) { var e, o = [], i = typeof t; if (r && "object" == i) for (e in t) try { o.push(n(t[e], r - 1)) } catch (n) { } return o.length ? o : "string" == i ? t : t + "\0" }((t = 1 == t ? { entropy: !0 } : t || {}).entropy ? [n, S(a)] : null == n ? function () { try { var n; return s && (n = s.randomBytes) ? n = n(l) : (n = new Uint8Array(l), (f.crypto || f.msCrypto).getRandomValues(n)), S(n) } catch (n) { var t = f.navigator, r = t && t.plugins; return [+new Date, f, r, f.screen, S(a)] } }() : n, 3), o), u = new m(o); return e.int32 = function () { return 0 | u.g(4) }, e.quick = function () { return u.g(4) / 4294967296 }, e.double = e, j(S(u.S), a), (t.pass || r || function (n, t, r, e) { return e && (e.S && v(e, u), n.state = function () { return v(u, {}) }), r ? (c[p] = n, t) : n })(e, i, "global" in t ? t.global : this == c, t.state) } function m(n) { var t, r = n.length, u = this, e = 0, o = u.i = u.j = 0, i = u.S = []; for (r || (n = [r++]); e < l;)i[e] = e++; for (e = 0; e < l; e++)i[e] = i[o = h & o + n[e % r] + (t = i[e])], i[o] = t; (u.g = function (n) { for (var t, r = 0, e = u.i, o = u.j, i = u.S; n--;)t = i[e = h & e + 1], r = r * l + i[h & (i[e] = i[o = h & o + t]) + (i[o] = t)]; return u.i = e, u.j = o, r })(l) } function v(n, t) { return t.i = n.i, t.j = n.j, t.S = n.S.slice(), t } function j(n, t) { for (var r, e = n + "", o = 0; o < e.length;)t[h & o] = h & (r ^= 19 * t[h & o]) + e.charCodeAt(o++); return S(t) } function S(n) { return String.fromCharCode.apply(0, n) } if (j(c.random(), a), "object" == typeof module && module.exports) { module.exports = n; try { s = require("crypto") } catch (n) { } } else "function" == typeof define && define.amd ? define(function () { return n }) : c["seed" + p] = n }("undefined" != typeof self ? self : this, [], Math);
    // MIT License
    // Copyright 2019 David Bau.
    // Permission is hereby granted, free of charge, to any person obtaining a copy
    // of this software and associated documentation files (the "Software"), to deal
    // in the Software without restriction, including without limitation the rights
    // to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    // copies of the Software, and to permit persons to whom the Software is
    // furnished to do so, subject to the following conditions:
    // The above copyright notice and this permission notice shall be included in all
    // copies or substantial portions of the Software.
    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    // FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    // LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    // OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    // SOFTWARE.
    let seed = !customData.again.seed | !customData.hard.seed | !customData.good.seed | !customData.easy.seed ? document.getElementById("qa").innerText : customData.good.seed;
    const generator = new Math.seedrandom(seed);
    const fuzz_factor = generator();
    seed = Math.round(fuzz_factor * 10000);
    customData.again.seed = (seed + 1) % 10000;
    customData.hard.seed = (seed + 2) % 10000;
    customData.good.seed = (seed + 3) % 10000;
    customData.easy.seed = (seed + 4) % 10000;
    return fuzz_factor;
}