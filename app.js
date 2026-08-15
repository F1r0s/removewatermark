/**
 * WatermarksCleaner - app.js
 * Layer A: Invisible Unicode / homoglyph space detection and cleaning
 * Ported from skills/remove-ai-marks/scripts/text_unicode.py
 */

// ═══ Codepoint sets (mirrored from text_unicode.py) ═══

const STRIP_CODEPOINTS = new Set([
  0x00AD, 0x034F, 0x061C, 0x115F, 0x1160, 0x17B4, 0x17B5,
  0x180B, 0x180C, 0x180D, 0x180E,
  0x200B, 0x200C, 0x200D, 0x200E, 0x200F,
  0x202A, 0x202B, 0x202C, 0x202D, 0x202E,
  0x2060, 0x2061, 0x2062, 0x2063, 0x2064,
  0x2066, 0x2067, 0x2068, 0x2069,
  0x206A, 0x206B, 0x206C, 0x206D, 0x206E, 0x206F,
  0xFEFF,
  0xFE00, 0xFE01, 0xFE02, 0xFE03, 0xFE04, 0xFE05,
  0xFE06, 0xFE07, 0xFE08, 0xFE09, 0xFE0A, 0xFE0B,
  0xFE0C, 0xFE0D, 0xFE0E, 0xFE0F,
  0xFFF9, 0xFFFA, 0xFFFB,
]);

const SPACE_HOMOGLYPHS = new Map([
  [0x00A0, ' '], [0x1680, ' '],
  [0x2000, ' '], [0x2001, ' '], [0x2002, ' '], [0x2003, ' '],
  [0x2004, ' '], [0x2005, ' '], [0x2006, ' '], [0x2007, ' '],
  [0x2008, ' '], [0x2009, ' '], [0x200A, ' '], [0x202F, ' '],
  [0x205F, ' '], [0x3000, ' '],
]);

const LATIN_CONFUSABLES = new Map([
  [0x0410,'A'],[0x0412,'B'],[0x0415,'E'],[0x041A,'K'],[0x041C,'M'],
  [0x041D,'H'],[0x041E,'O'],[0x0420,'P'],[0x0421,'C'],[0x0422,'T'],
  [0x0425,'X'],[0x0430,'a'],[0x0435,'e'],[0x043E,'o'],[0x0440,'p'],
  [0x0441,'c'],[0x0443,'y'],[0x0445,'x'],[0x0456,'i'],
  [0xFF21,'A'],[0xFF22,'B'],[0xFF23,'C'],[0xFF24,'D'],[0xFF25,'E'],
  [0xFF26,'F'],[0xFF27,'G'],[0xFF28,'H'],[0xFF29,'I'],[0xFF2A,'J'],
  [0xFF2B,'K'],[0xFF2C,'L'],[0xFF2D,'M'],[0xFF2E,'N'],[0xFF2F,'O'],
  [0xFF30,'P'],[0xFF31,'Q'],[0xFF32,'R'],[0xFF33,'S'],[0xFF34,'T'],
  [0xFF35,'U'],[0xFF36,'V'],[0xFF37,'W'],[0xFF38,'X'],[0xFF39,'Y'],
  [0xFF3A,'Z'],[0xFF41,'a'],[0xFF42,'b'],[0xFF43,'c'],[0xFF44,'d'],
  [0xFF45,'e'],[0xFF46,'f'],[0xFF47,'g'],[0xFF48,'h'],[0xFF49,'i'],
  [0xFF4A,'j'],[0xFF4B,'k'],[0xFF4C,'l'],[0xFF4D,'m'],[0xFF4E,'n'],
  [0xFF4F,'o'],[0xFF50,'p'],[0xFF51,'q'],[0xFF52,'r'],[0xFF53,'s'],
  [0xFF54,'t'],[0xFF55,'u'],[0xFF56,'v'],[0xFF57,'w'],[0xFF58,'x'],
  [0xFF59,'y'],[0xFF5A,'z'],
]);

const BIDI_CPS = new Set([
  0x061C,0x200E,0x200F,0x202A,0x202B,0x202C,0x202D,0x202E,0x2066,0x2067,0x2068,0x2069
]);
const ZW_FAMILY = new Set([0x200B,0x200C,0x200D,0x2060,0xFEFF,0x180E]);

const CP_NAMES = {
  0x00AD:'SOFT HYPHEN',0x034F:'COMBINING GRAPHEME JOINER',0x061C:'ARABIC LETTER MARK',
  0x115F:'HANGUL CHOSEONG FILLER',0x1160:'HANGUL JUNGSEONG FILLER',
  0x17B4:'KHMER VOWEL INHERENT AQ',0x17B5:'KHMER VOWEL INHERENT AA',
  0x180B:'MONGOLIAN FREE VARIATION SELECTOR-1',0x180C:'MONGOLIAN FREE VARIATION SELECTOR-2',
  0x180D:'MONGOLIAN FREE VARIATION SELECTOR-3',0x180E:'MONGOLIAN VOWEL SEPARATOR',
  0x200B:'ZERO WIDTH SPACE',0x200C:'ZERO WIDTH NON-JOINER',0x200D:'ZERO WIDTH JOINER',
  0x200E:'LEFT-TO-RIGHT MARK',0x200F:'RIGHT-TO-LEFT MARK',
  0x202A:'LEFT-TO-RIGHT EMBEDDING',0x202B:'RIGHT-TO-LEFT EMBEDDING',
  0x202C:'POP DIRECTIONAL FORMATTING',0x202D:'LEFT-TO-RIGHT OVERRIDE',0x202E:'RIGHT-TO-LEFT OVERRIDE',
  0x2060:'WORD JOINER',0x2061:'FUNCTION APPLICATION',0x2062:'INVISIBLE TIMES',
  0x2063:'INVISIBLE SEPARATOR',0x2064:'INVISIBLE PLUS',
  0x2066:'LEFT-TO-RIGHT ISOLATE',0x2067:'RIGHT-TO-LEFT ISOLATE',
  0x2068:'FIRST STRONG ISOLATE',0x2069:'POP DIRECTIONAL ISOLATE',
  0xFEFF:'BYTE ORDER MARK / ZERO WIDTH NO-BREAK SPACE',
  0x00A0:'NO-BREAK SPACE',0x3000:'IDEOGRAPHIC SPACE',
};

function getCpName(cp) {
  if (CP_NAMES[cp]) return CP_NAMES[cp];
  if (cp >= 0xFE00 && cp <= 0xFE0F) return `VARIATION SELECTOR-${cp - 0xFE00 + 1}`;
  if (cp >= 0xE0001 && cp <= 0xE007F) return `TAG CHARACTER U+${cp.toString(16).toUpperCase()}`;
  if (cp >= 0x180B && cp <= 0x180D) return `MONGOLIAN FREE VARIATION SELECTOR-${cp - 0x180B + 1}`;
  if (cp >= 0x206A && cp <= 0x206F) return `DEPRECATED FORMAT CHAR U+${cp.toString(16).toUpperCase()}`;
  if (cp >= 0x2000 && cp <= 0x200A) return `UNICODE SPACE U+${cp.toString(16).toUpperCase()}`;
  return `U+${cp.toString(16).toUpperCase().padStart(4,'0')}`;
}

function isStripCp(cp) {
  if (STRIP_CODEPOINTS.has(cp)) return true;
  if (cp >= 0xE0100 && cp <= 0xE01F0) return true; // VS supplement
  if (cp >= 0xE0001 && cp <= 0xE007F) return true; // tag chars
  return false;
}

function stripKind(cp) {
  if (cp >= 0xE0001 && cp <= 0xE007F) return 'tag_chars';
  if ((cp >= 0xE0100 && cp <= 0xE01F0) || (cp >= 0xFE00 && cp <= 0xFE0F) || (cp >= 0x180B && cp <= 0x180D)) return 'variation_selector';
  if (BIDI_CPS.has(cp)) return 'bidi';
  if (ZW_FAMILY.has(cp)) return 'zero_width';
  return 'invisible';
}

/**
 * Inspect text for suspicious characters. Returns { hits, total, length }
 */
function inspectText(text, opts = {}) {
  const { aggressive = false, normalizeSpaces = true } = opts;
  const buckets = new Map(); // key: `${cp}:${kind}` => { cp, kind, count, offsets }

  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i);
    if (cp > 0xFFFF) i++; // surrogate pair

    let kind = null;
    if (isStripCp(cp)) {
      kind = stripKind(cp);
    } else if (normalizeSpaces && SPACE_HOMOGLYPHS.has(cp)) {
      kind = 'space_homoglyph';
    } else if (aggressive && LATIN_CONFUSABLES.has(cp)) {
      kind = 'confusable';
    }

    if (kind === null) continue;
    const key = `${cp}:${kind}`;
    if (!buckets.has(key)) buckets.set(key, { cp, kind, count: 0, offsets: [] });
    const b = buckets.get(key);
    b.count++;
    if (b.offsets.length < 10) b.offsets.push(i);
  }

  let total = 0;
  const hits = [];
  for (const b of buckets.values()) {
    total += b.count;
    hits.push({ ...b, label: `U+${b.cp.toString(16).toUpperCase().padStart(4,'0')} ${getCpName(b.cp)}` });
  }
  hits.sort((a, b) => b.count - a.count);

  return { hits, total, length: text.length };
}

/**
 * Clean text — returns { cleaned, stats, hits }
 */
function cleanText(text, opts = {}) {
  const { normalizeSpaces = true, aggressive = false } = opts;
  const removed = new Map();
  const replaced = new Map();
  const out = [];

  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i);
    const ch = cp > 0xFFFF ? String.fromCodePoint(cp) : text[i];
    if (cp > 0xFFFF) i++;

    if (isStripCp(cp)) {
      const label = getCpName(cp);
      removed.set(label, (removed.get(label) || 0) + 1);
      continue;
    }
    if (normalizeSpaces && SPACE_HOMOGLYPHS.has(cp)) {
      const label = getCpName(cp);
      replaced.set(label, (replaced.get(label) || 0) + 1);
      out.push(' ');
      continue;
    }
    if (aggressive && LATIN_CONFUSABLES.has(cp)) {
      const label = getCpName(cp);
      replaced.set(label, (replaced.get(label) || 0) + 1);
      out.push(LATIN_CONFUSABLES.get(cp));
      continue;
    }
    out.push(ch);
  }

  const cleaned = out.join('');
  const removedTotal = [...removed.values()].reduce((a, b) => a + b, 0);
  const replacedTotal = [...replaced.values()].reduce((a, b) => a + b, 0);

  return {
    cleaned,
    stats: {
      inputLength: text.length,
      outputLength: cleaned.length,
      removedCount: removedTotal,
      replacedCount: replacedTotal,
      removed: Object.fromEntries(removed),
      replaced: Object.fromEntries(replaced),
    }
  };
}

// ═══════════════════════════════════════
// DOM Logic
// ═══════════════════════════════════════

const $ = id => document.getElementById(id);

const inputText = $('input-text');
const outputArea = $('output-area');
const outputPlaceholder = $('output-placeholder');
const scanBtn = $('scan-btn');
const copyBtn = $('copy-btn');
const clearBtn = $('clear-btn');
const loadSampleBtn = $('load-sample-btn');
const inputCharCount = $('input-char-count');
const outputCharCount = $('output-char-count');
const statsBanner = $('stats-banner');
const statRemovedText = $('stat-removed-text');
const statReplacedText = $('stat-replaced-text');
const statCleanText = $('stat-clean-text');
const statHitsItem = $('stat-hits-item');
const statHitsText = $('stat-hits-text');
const hitsDetail = $('hits-detail');
const hitsList = $('hits-list');

// Sample text with injected watermarks
const SAMPLE_TEXT = "This is a sample text generated by an AI model.\u200B It demonstrates how invisible watermarks\u200C are injected into\u200D content.\u200E The marks are\u200F completely invisible in\u2060 most editors but can be detected by specialized tools.\uFEFF\n\nAI providers use these\u202A signals to identify their output.\u202B By using Layer\u2062 A cleaning\u2063, we can strip all\u2064 these invisible\u2066 characters\u2069 and restore clean\u00A0text for\u2003 privacy and hygiene purposes.";

// Character count
inputText.addEventListener('input', () => {
  const len = inputText.value.length;
  inputCharCount.textContent = `${len.toLocaleString()} character${len !== 1 ? 's' : ''}`;
});

// Load sample
loadSampleBtn.addEventListener('click', () => {
  inputText.value = SAMPLE_TEXT;
  inputCharCount.textContent = `${SAMPLE_TEXT.length.toLocaleString()} characters (with hidden marks)`;
  inputText.focus();
});

// Clear
clearBtn.addEventListener('click', () => {
  inputText.value = '';
  inputCharCount.textContent = '0 characters';
  resetOutput();
});

function resetOutput() {
  if (outputPlaceholder) outputPlaceholder.style.display = 'flex';
  if (outputArea.querySelector('.clean-output')) {
    outputArea.querySelector('.clean-output').remove();
  }
  outputCharCount.textContent = '';
  copyBtn.disabled = true;
  statsBanner.hidden = true;
  hitsDetail.hidden = true;
  copyBtn._cleanText = null;
}

// Copy
copyBtn.addEventListener('click', () => {
  if (!copyBtn._cleanText) return;
  navigator.clipboard.writeText(copyBtn._cleanText).then(() => {
    const orig = copyBtn.textContent;
    copyBtn.textContent = '✓ Copied!';
    copyBtn.style.color = 'var(--green)';
    setTimeout(() => { copyBtn.textContent = orig; copyBtn.style.color = ''; }, 2000);
  });
});

// Scan
scanBtn.addEventListener('click', performScan);
inputText.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') performScan();
});

function performScan() {
  const text = inputText.value;
  if (!text.trim()) {
    inputText.classList.add('shake');
    setTimeout(() => inputText.classList.remove('shake'), 400);
    return;
  }

  scanBtn.classList.add('scanning');
  scanBtn.disabled = true;

  // Small delay for visual feedback
  setTimeout(() => {
    const opts = {
      normalizeSpaces: $('opt-spaces').checked,
      aggressive: $('opt-confusables').checked,
    };

    const { cleaned, stats } = cleanText(text, opts);
    const { hits, total } = inspectText(text, opts);

    scanBtn.classList.remove('scanning');
    scanBtn.disabled = false;

    renderOutput(cleaned, stats, hits, total);
  }, 300);
}

function kindColor(kind) {
  const map = {
    zero_width: 'hsl(0,80%,60%)',
    bidi: 'hsl(30,90%,60%)',
    tag_chars: 'hsl(280,70%,65%)',
    variation_selector: 'hsl(200,70%,60%)',
    space_homoglyph: 'hsl(55,80%,55%)',
    confusable: 'hsl(160,70%,50%)',
    invisible: 'hsl(0,60%,60%)',
  };
  return map[kind] || 'hsl(0,0%,60%)';
}

function renderOutput(cleaned, stats, hits, total) {
  // Clear old
  if (outputPlaceholder) outputPlaceholder.style.display = 'none';
  const existing = outputArea.querySelector('.clean-output');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.className = 'clean-output';
  div.textContent = cleaned;
  outputArea.appendChild(div);

  // Update char count
  outputCharCount.textContent = `${cleaned.length.toLocaleString()} characters`;

  // Enable copy
  copyBtn.disabled = false;
  copyBtn._cleanText = cleaned;

  // Stats
  statsBanner.hidden = false;
  statsBanner.style.display = 'flex';
  statRemovedText.textContent = `${stats.removedCount} invisible char${stats.removedCount !== 1 ? 's' : ''} removed`;
  statReplacedText.textContent = `${stats.replacedCount} space char${stats.replacedCount !== 1 ? 's' : ''} normalized`;

  if (total === 0) {
    statCleanText.textContent = '✅ No watermarks found — text is clean!';
    statHitsItem.hidden = true;
  } else {
    statCleanText.textContent = `🧹 ${total} mark${total !== 1 ? 's' : ''} stripped`;
    statHitsItem.hidden = false;
    statHitsText.textContent = `${hits.length} mark type${hits.length !== 1 ? 's' : ''} detected`;
  }

  // Hits detail
  if (hits.length > 0) {
    hitsDetail.hidden = false;
    hitsList.innerHTML = '';
    hits.forEach(h => {
      const item = document.createElement('div');
      item.className = 'hit-item';
      item.setAttribute('role', 'listitem');
      item.innerHTML = `
        <span class="hit-kind" style="background:${kindColor(h.kind)}22;color:${kindColor(h.kind)}">${h.kind.replace(/_/g,' ')}</span>
        <div>
          <span class="hit-label">${h.label}</span>
          <span class="hit-count"> — found <strong>${h.count}x</strong></span>
        </div>`;
      hitsList.appendChild(item);
    });
  } else {
    hitsDetail.hidden = true;
  }
}

// ═══════════════════════════════════════
// Navbar scroll effect
// ═══════════════════════════════════════
const navbar = $('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ═══════════════════════════════════════
// Canvas particle animation (hero)
// ═══════════════════════════════════════
(function initCanvas() {
  const canvas = $('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles;

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    if (!particles) initParticles();
  }

  function initParticles() {
    particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.5 + 0.1,
      color: Math.random() > 0.5 ? '108,99,255' : '0,212,255',
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
      ctx.fill();
    });
    // Draw connecting lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(108,99,255,${0.06 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();
  draw();
})();

// ═══════════════════════════════════════
// Intersection Observer for animations
// ═══════════════════════════════════════
(function initAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('animate-in');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.layer-card, .feature-card, .section-header').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
})();
