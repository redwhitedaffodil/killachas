// overlay-ui.js - Visual Overlay & Highlighting
class OverlayUI {
    constructor() {
        this.container = null;
        this.scoreBar = null;
        this. bestMoveText = null;
        this.highlights = [];
    }

    inject() {
        // Create draggable floating container
        this.container = document. createElement('div');
        this.container.id = 'ck-eval-container';
        this.container.innerHTML = `
            <div class="ck-header">♟ Analysis</div>
            <div class="ck-score-bar">
                <div class="ck-score-fill"></div>
                <span class="ck-score-text">0.0</span>
            </div>
            <div class="ck-best-move">Best: --</div>
            <div class="ck-depth">Depth: 0</div>
        `;
        
        const styles = document.createElement('style');
        styles.textContent = `
            #ck-eval-container {
                position: fixed;
                top: 100px;
                right: 20px;
                width: 180px;
                background: rgba(30, 30, 30, 0.95);
                border-radius: 8px;
                padding: 12px;
                z-index:  999999;
                font-family: 'Segoe UI', sans-serif;
                color: #fff;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                cursor: move;
                user-select: none;
            }
            . ck-header {
                font-weight: bold;
                margin-bottom: 10px;
                font-size: 14px;
            }
            .ck-score-bar {
                height:  24px;
                background: #333;
                border-radius: 4px;
                position: relative;
                overflow: hidden;
                margin-bottom: 8px;
            }
            . ck-score-fill {
                height: 100%;
                width: 50%;
                background: linear-gradient(90deg, #00b894, #00cec9);
                transition: width 0.3s, background 0.3s;
            }
            .ck-score-fill. losing {
                background: linear-gradient(90deg, #ff3333, #e74c3c);
            }
            .ck-score-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-weight: bold;
                text-shadow: 0 1px 2px rgba(0,0,0,0.8);
            }
            .ck-best-move, .ck-depth {
                font-size: 13px;
                margin:  4px 0;
            }
            .ck-highlight {
                position: absolute;
                pointer-events: none;
                border-radius: 4px;
                z-index: 100;
            }
            .ck-highlight-from {
                background: rgba(0, 184, 148, 0.5);
                box-shadow: inset 0 0 0 3px #00b894;
            }
            .ck-highlight-to {
                background: rgba(0, 184, 148, 0.7);
                box-shadow: inset 0 0 0 3px #00b894;
            }
        `;
        
        document.head.appendChild(styles);
        document.body.appendChild(this.container);
        
        this._makeDraggable();
    }

    _makeDraggable() {
        let offsetX, offsetY, isDragging = false;
        
        this.container.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - this.container.offsetLeft;
            offsetY = e.clientY - this.container.offsetTop;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            this.container.style.left = (e.clientX - offsetX) + 'px';
            this.container.style.top = (e.clientY - offsetY) + 'px';
            this.container.style.right = 'auto';
        });
        
        document.addEventListener('mouseup', () => isDragging = false);
    }

    updateScore(score, depth) {
        const fill = this.container.querySelector('.ck-score-fill');
        const text = this.container.querySelector('. ck-score-text');
        const depthEl = this.container.querySelector('. ck-depth');
        
        // Score clamped to -10 to +10 for display
        const clampedScore = Math.max(-10, Math.min(10, score));
        const percentage = ((clampedScore + 10) / 20) * 100;
        
        fill.style. width = percentage + '%';
        fill.classList.toggle('losing', score < 0);
        text.textContent = (score > 0 ? '+' : '') + score. toFixed(1);
        depthEl.textContent = `Depth: ${depth}`;
    }

    updateBestMove(move) {
        const el = this.container.querySelector('. ck-best-move');
        el.textContent = `Best: ${move}`;
    }

    highlightMove(move, boardElement) {
        this.clearHighlights();
        
        if (! move || move. length < 4) return;
        
        const from = move.slice(0, 2);
        const to = move.slice(2, 4);
        
        [{ sq: from, cls: 'ck-highlight-from' }, { sq: to, cls: 'ck-highlight-to' }]
            .forEach(({ sq, cls }) => {
                const squareEl = this._findSquareElement(sq, boardElement);
                if (squareEl) {
                    const rect = squareEl.getBoundingClientRect();
                    const highlight = document.createElement('div');
                    highlight.className = `ck-highlight ${cls}`;
                    highlight.style.cssText = `
                        left: ${rect.left + window.scrollX}px;
                        top: ${rect.top + window.scrollY}px;
                        width: ${rect.width}px;
                        height:  ${rect.height}px;
                    `;
                    document.body.appendChild(highlight);
                    this.highlights.push(highlight);
                }
            });
    }

    _findSquareElement(square, boardElement) {
        // Try various selector patterns
        return boardElement.querySelector(`[data-square="${square}"]`) ||
               boardElement.querySelector(`.square-${square}`) ||
               boardElement.querySelector(`#${square}`);
    }

    clearHighlights() {
        this.highlights.forEach(h => h.remove());
        this.highlights = [];
    }
}
