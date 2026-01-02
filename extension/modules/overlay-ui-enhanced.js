// Add to OverlayUI class
class OverlayUI {
    // ... existing methods ... 

    createEngineSelector(engines, activeEngine, onSelect) {
        const selector = document.createElement('div');
        selector.className = 'ck-engine-selector';
        selector.innerHTML = `
            <label>Engine:</label>
            <select class="ck-engine-select">
                ${engines.map(e => `
                    <option value="${e}" ${e === activeEngine ? 'selected' : ''}>${e}</option>
                `).join('')}
            </select>
        `;
        
        const select = selector.querySelector('select');
        select.addEventListener('change', () => onSelect(select.value));
        
        this.container.appendChild(selector);
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .ck-engine-selector {
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid #444;
            }
            . ck-engine-selector label {
                font-size: 12px;
                color: #aaa;
            }
            .ck-engine-select {
                width: 100%;
                margin-top: 5px;
                padding: 5px;
                background: #333;
                color: #fff;
                border: 1px solid #555;
                border-radius: 4px;
                cursor: pointer;
            }
            .ck-connection-status {
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius:  50%;
                margin-left: 8px;
            }
            .ck-connection-status.connected { background: #00b894; }
            .ck-connection-status.disconnected { background: #ff3333; }
        `;
        document.head.appendChild(style);
    }

    updateConnectionStatus(connected) {
        let indicator = this.container.querySelector('. ck-connection-status');
        if (! indicator) {
            indicator = document.createElement('span');
            indicator.className = 'ck-connection-status';
            this.container.querySelector('.ck-header').appendChild(indicator);
        }
        indicator.classList.toggle('connected', connected);
        indicator.classList.toggle('disconnected', !connected);
        indicator.title = connected ? 'Connected' :  'Disconnected';
    }

    updateEngineName(name) {
        const header = this.container.querySelector('. ck-header');
        header.textContent = `♟ ${name}`;
    }

    updateLine(line) {
        let lineEl = this.container.querySelector('. ck-line');
        if (!lineEl) {
            lineEl = document.createElement('div');
            lineEl.className = 'ck-line';
            lineEl.style.cssText = 'font-size: 11px;color:#888;margin-top:5px;word-break:break-all;';
            this.container.appendChild(lineEl);
        }
        lineEl.textContent = line;
    }
}
