// overlay-ui-multipv.js - Enhanced UI with MultiPV display
class OverlayUI {
    constructor() {
        this.container = null;
        this.highlights = [];
        this.multiPVContainer = null;
    }

    inject() {
        this.container = document.createElement('div');
        this.container.id = 'ck-eval-container';
        this.container.innerHTML = `
            <div class="ck-header">
                <span class="ck-title">♟ Analysis</span>
                <span class="ck-connection-status" title="Disconnected"></span>
                <button class="ck-minimize-btn" title="Minimize">−</button>
            </div>
            <div class="ck-body">
                <div class="ck-score-section">
                    <div class="ck-score-bar">
                        <div class="ck-score-fill"></div>
                        <span class="ck-score-text">0. 0</span>
                    </div>
                    <div class="ck-score-details">
                        <span class="ck-depth">Depth: 0</span>
                        <span class="ck-nps"></span>
                    </div>
                </div>
                <div class="ck-best-move-section">
                    <div class="ck-best-move">Best:  --</div>
                </div>
                <div class="ck-multipv-section">
                    <div class="ck-multipv-header">
                        <span>Lines</span>
                        <select class="ck-multipv-select">
                            <option value="1">1 line</option>
                            <option value="3" selected>3 lines</option>
                            <option value="5">5 lines</option>
                            <option value="10">10 lines</option>
                        </select>
                    </div>
                    <div class="ck-multipv-lines"></div>
                </div>
                <div class="ck-controls-section">
                    <div class="ck-engine-selector"></div>
                    <div class="ck-settings">
                        <label class="ck-checkbox">
                            <input type="checkbox" class="ck-autoplay-toggle">
                            <span>Auto-play</span>
                        </label>
                        <select class="ck-move-method">
                            <option value="mouseclick">Mouse Click</option>
                            <option value="teleport">Teleport</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
        
        this._injectStyles();
        document.body.appendChild(this.container);
        this._setupEventListeners();
        this._makeDraggable();
    }

    _injectStyles() {
        const styles = document.createElement('style');
        styles.textContent = `
            #ck-eval-container {
                position: fixed;
                top: 100px;
                right: 20px;
                width: 280px;
                background: rgba(25, 25, 30, 0.97);
                border-radius: 10px;
                z-index: 999999;
                font-family: 'Segoe UI', -apple-system, sans-serif;
                color: #e0e0e0;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                user-select: none;
                overflow: hidden;
                border: 1px solid rgba(255,255,255,0.1);
            }
            
            #ck-eval-container.minimized . ck-body {
                display: none;
            }
            
            . ck-header {
                display: flex;
                align-items: center;
                padding: 10px 12px;
                background: rgba(255,255,255,0.05);
                cursor: move;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            
            .ck-title {
                flex: 1;
                font-weight: 600;
                font-size: 14px;
            }
            
            .ck-connection-status {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #ff3333;
                margin-right: 10px;
                transition: background 0.3s;
            }
            
            .ck-connection-status.connected {
                background: #00b894;
            }
            
            .ck-minimize-btn {
                background: none;
                border: none;
                color: #888;
                font-size: 18px;
                cursor: pointer;
                padding: 0 5px;
                line-height: 1;
            }
            
            .ck-minimize-btn:hover {
                color: #fff;
            }
            
            .ck-body {
                padding: 12px;
            }
            
            .ck-score-section {
                margin-bottom: 12px;
            }
            
            .ck-score-bar {
                height: 28px;
                background: linear-gradient(90deg, #2d2d35 0%, #3d3d45 100%);
                border-radius: 6px;
                position: relative;
                overflow: hidden;
                margin-bottom: 6px;
            }
            
            .ck-score-fill {
                height: 100%;
                width: 50%;
                background: linear-gradient(90deg, #00b894, #00cec9);
                transition: width 0.4s ease, background 0.3s;
                border-radius: 6px;
            }
            
            .ck-score-fill. losing {
                background: linear-gradient(90deg, #e74c3c, #c0392b);
            }
            
            .ck-score-fill.mate {
                background: linear-gradient(90deg, #9b59b6, #8e44ad);
            }
            
            .ck-score-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-weight: 700;
                font-size: 14px;
                text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            }
            
            .ck-score-details {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: #888;
            }
            
            .ck-best-move-section {
                padding: 8px 10px;
                background: rgba(255,255,255,0.03);
                border-radius: 6px;
                margin-bottom:  12px;
            }
            
            .ck-best-move {
                font-size: 15px;
                font-weight:  600;
                color: #00cec9;
            }
            
            /* MultiPV Styles */
            .ck-multipv-section {
                margin-bottom: 12px;
            }
            
            .ck-multipv-header {
                display: flex;
                justify-content: space-between;
                align-items:  center;
                margin-bottom:  8px;
                font-size: 12px;
                color: #888;
            }
            
            .ck-multipv-select {
                background: #2d2d35;
                color: #e0e0e0;
                border: 1px solid #444;
                border-radius: 4px;
                padding: 3px 8px;
                font-size: 11px;
                cursor: pointer;
            }
            
            .ck-multipv-lines {
                max-height: 200px;
                overflow-y: auto;
            }
            
            .ck-multipv-line {
                display: flex;
                align-items: flex-start;
                padding: 6px 8px;
                margin-bottom: 4px;
                background: rgba(255,255,255,0.03);
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .ck-multipv-line:hover {
                background: rgba(255,255,255,0.08);
            }
            
            .ck-multipv-line.best {
                border-left: 3px solid #00b894;
            }
            
            .ck-multipv-rank {
                width: 20px;
                font-weight: 700;
                color: #666;
            }
            
            .ck-multipv-score {
                width: 50px;
                font-weight:  600;
            }
            
            .ck-multipv-score.positive { color: #00b894; }
            .ck-multipv-score.negative { color: #e74c3c; }
            . ck-multipv-score. mate { color: #9b59b6; }
            
            .ck-multipv-moves {
                flex: 1;
                color: #aaa;
                font-family: 'Consolas', monospace;
                font-size: 11px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            /* Controls */
            .ck-controls-section {
                padding-top: 10px;
                border-top: 1px solid rgba(255,255,255,0.1);
            }
            
            .ck-engine-selector select,
            .ck-move-method {
                width: 100%;
                background: #2d2d35;
                color: #e0e0e0;
                border: 1px solid #444;
                border-radius: 4px;
                padding: 6px 10px;
                font-size:  12px;
                cursor: pointer;
                margin-bottom: 8px;
            }
            
            .ck-settings {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .ck-checkbox {
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 12px;
                cursor: pointer;
            }
            
            .ck-checkbox input {
                cursor: pointer;
            }
            
            /* Scrollbar */
            .ck-multipv-lines::-webkit-scrollbar {
                width: 6px;
            }
            
            .ck-multipv-lines::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.05);
                border-radius: 3px;
            }
            
            . ck-multipv-lines: :-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.2);
                border-radius: 3px;
            }
            
            /* Board Highlights */
            .ck-highlight {
                position: absolute;
                pointer-events: none;
                border-radius: 2px;
                z-index:  100;
            }
            
            .ck-highlight-from {
                background: rgba(0, 184, 148, 0.4);
                box-shadow: inset 0 0 0 2px rgba(0, 184, 148, 0.8);
            }
            
            .ck-highlight-to {
                background: rgba(0, 206, 201, 0.5);
                box-shadow: inset 0 0 0 2px rgba(0, 206, 201, 0.9);
            }
            
            . ck-highlight-alt {
                background: rgba(255, 193, 7, 0.3);
                box-shadow: inset 0 0 0 2px rgba(255, 193, 7, 0.6);
            }
        `;
        
        document.head.appendChild(styles);
    }

    _setupEventListeners() {
        // Minimize button
        const minimizeBtn = this.container.querySelector('.ck-minimize-btn');
        minimizeBtn.addEventListener('click', () => {
            this.container. classList.toggle('minimized');
            minimizeBtn.textContent = this. container.classList.contains('minimized') ? '+' : '−';
        });
        
        // MultiPV selector
        const multipvSelect = this.container.querySelector('.ck-multipv-select');
        multipvSelect.addEventListener('change', () => {
            this.onMultiPVChange? .(parseInt(multipvSelect.value));
        });
        
        // Auto-play toggle
        const autoplayToggle = this.container.querySelector('.ck-autoplay-toggle');
        autoplayToggle. addEventListener('change', () => {
            this.onAutoPlayChange?.(autoplayToggle. checked);
        });
        
        // Move method selector
        const moveMethod = this.container.querySelector('. ck-move-method');
        moveMethod.addEventListener('change', () => {
            this.onMoveMethodChange?.(moveMethod. value);
        });
    }

    _makeDraggable() {
        const header = this.container.querySelector('. ck-header');
        let offsetX, offsetY, isDragging = false;
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('ck-minimize-btn')) return;
            isDragging = true;
            offsetX = e.clientX - this.container.offsetLeft;
            offsetY = e.clientY - this. container.offsetTop;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            this.container.style.left = (e.clientX - offsetX) + 'px';
            this.container.style.top = (e.clientY - offsetY) + 'px';
            this.container.style.right = 'auto';
        });
        
        document.addEventListener('mouseup', () => isDragging = false);
    }

    // ═══════════════════════════════════════════════════════════
    // UPDATE METHODS
    // ═══════════════════════════════════════════════════════════

    updateScore(score, depth, scoreType = 'cp') {
        const fill = this.container.querySelector('. ck-score-fill');
        const text = this.container.querySelector('. ck-score-text');
        const depthEl = this.container.querySelector('. ck-depth');
        
        fill.classList.remove('losing', 'mate');
        
        if (scoreType === 'mate') {
            fill.classList.add('mate');
            fill.style.width = score > 0 ? '95%' : '5%';
            text.textContent = score > 0 ? `M${score}` : `-M${Math.abs(score)}`;
        } else {
            const clampedScore = Math.max(-10, Math.min(10, score));
            const percentage = ((clampedScore + 10) / 20) * 100;
            
            fill.style.width = percentage + '%';
            fill.classList.toggle('losing', score < -0.5);
            text.textContent = (score > 0 ? '+' : '') + score. toFixed(2);
        }
        
        depthEl.textContent = `Depth: ${depth}`;
    }

    updateBestMove(move) {
        const el = this.container.querySelector('. ck-best-move');
        el.textContent = `Best: ${move}`;
    }

    updateNPS(nps) {
        const el = this.container.querySelector('.ck-nps');
        if (nps > 0) {
            const formatted = nps > 1000000 
                ? (nps / 1000000).toFixed(1) + 'M'
                :  nps > 1000 
                    ? (nps / 1000).toFixed(0) + 'k'
                    : nps;
            el.textContent = `${formatted} n/s`;
        }
    }

    updateMultiPV(lines) {
        const container = this.container. querySelector('.ck-multipv-lines');
        container.innerHTML = '';
        
        lines.forEach((line, index) => {
            const lineEl = document.createElement('div');
            lineEl.className = `ck-multipv-line ${index === 0 ? 'best' : ''}`;
            lineEl.dataset.move = line. pv[0] || '';
            
            // Format score
            let scoreText, scoreClass;
            if (line.scoreType === 'mate') {
                scoreText = line.score > 0 ? `M${line.score}` : `-M${Math.abs(line.score)}`;
                scoreClass = 'mate';
            } else {
                scoreText = (line.score > 0 ?  '+' : '') + line.score.toFixed(2);
                scoreClass = line.score >= 0 ? 'positive' : 'negative';
            }
            
            // Format moves (convert to SAN if possible, otherwise use UCI)
            const movesText = line.pv.slice(0, 6).join(' ');
            
            lineEl.innerHTML = `
                <span class="ck-multipv-rank">${line.multipv}.</span>
                <span class="ck-multipv-score ${scoreClass}">${scoreText}</span>
                <span class="ck-multipv-moves" title="${line.pv.join(' ')}">${movesText}</span>
            `;
            
            // Click to highlight this line's move
            lineEl.addEventListener('click', () => {
                this. onLineClick?.(line);
            });
            
            container.appendChild(lineEl);
        });
    }

    updateConnectionStatus(connected) {
        const indicator = this.container.querySelector('. ck-connection-status');
        indicator.classList.toggle('connected', connected);
        indicator.title = connected ? 'Connected' :  'Disconnected';
    }

    updateEngineName(name) {
        const title = this.container.querySelector('. ck-title');
        title.textContent = `♟ ${name}`;
    }

    createEngineSelector(engines, activeEngine, onSelect) {
        const container = this.container.querySelector('.ck-engine-selector');
        container. innerHTML = `
            <select>
                ${engines.map(e => `
                    <option value="${e}" ${e === activeEngine ? 'selected' : ''}>${e}</option>
                `).join('')}
            </select>
        `;
        
        const select = container.querySelector('select');
        select.addEventListener('change', () => onSelect(select.value));
    }

    // Callbacks
    onMultiPVChange = null;
    onAutoPlayChange = null;
    onMoveMethodChange = null;
    onLineClick = null;
}
