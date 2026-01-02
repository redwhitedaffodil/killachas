// engine-websocket-client-multipv.js - Enhanced with MultiPV support
class EngineWebSocketClient {
    constructor(serverUrl = 'ws://localhost:8000/ws') {
        this.serverUrl = serverUrl;
        this.apiUrl = serverUrl.replace('ws://', 'http://').replace('/ws', '');
        this.ws = null;
        this. isConnected = false;
        this.isReady = false;
        this. reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // Callbacks
        this.onAnalysis = null;
        this.onBestMove = null;
        this.onEngineInfo = null;
        this.onConnectionChange = null;
        this.onMultiPVUpdate = null; // New:  MultiPV callback
        
        // State
        this.currentEngine = null;
        this. availableEngines = [];
        
        // MultiPV state
        this.multiPVCount = 1;
        this.multiPVLines = new Map(); // Store all PV lines
        this.currentDepth = 0;
    }

    // ═══════════════════════════════════════════════════════════
    // CONNECTION MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    async connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.serverUrl);
                
                this.ws. onopen = () => {
                    console.log('[Engine] WebSocket connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.onConnectionChange?.(true);
                    resolve();
                };
                
                this.ws.onclose = (event) => {
                    console.log('[Engine] WebSocket closed:', event. code);
                    this.isConnected = false;
                    this. isReady = false;
                    this.onConnectionChange?.(false);
                    this._attemptReconnect();
                };
                
                this.ws. onerror = (error) => {
                    console.error('[Engine] WebSocket error:', error);
                    reject(error);
                };
                
                this.ws.onmessage = (event) => {
                    this._handleMessage(event.data);
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }

    async _attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[Engine] Max reconnect attempts reached');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        
        console.log(`[Engine] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        await new Promise(r => setTimeout(r, delay));
        
        try {
            await this.connect();
        } catch (e) {
            console.error('[Engine] Reconnect failed');
        }
    }

    disconnect() {
        if (this. ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.isReady = false;
    }

    // ═══════════════════════════════════════════════════════════
    // MESSAGE HANDLING
    // ═══════════════════════════════════════════════════════════

    _handleMessage(data) {
        const line = data.trim();
        
        // Connection info from server
        if (line.startsWith('info string Connected')) {
            const engineMatch = line.match(/Connected to (. +)/);
            if (engineMatch) {
                this.currentEngine = engineMatch[1];
                console.log('[Engine] Active engine:', this.currentEngine);
            }
            return;
        }
        
        // Engine ready
        if (line === 'readyok') {
            this.isReady = true;
            console. log('[Engine] Ready');
            return;
        }
        
        // UCI initialization complete
        if (line === 'uciok') {
            console.log('[Engine] UCI OK');
            return;
        }
        
        // Engine identity
        if (line.startsWith('id name')) {
            const name = line.replace('id name ', '');
            this.onEngineInfo?. ({ type: 'name', value: name });
            return;
        }
        
        // Analysis info:  "info depth 15 multipv 1 score cp 125 pv e2e4 e7e5..."
        if (line.startsWith('info') && line.includes('score')) {
            const analysis = this._parseInfoLine(line);
            if (analysis) {
                this._handleAnalysis(analysis);
            }
            return;
        }
        
        // Best move:  "bestmove e2e4 ponder e7e5"
        if (line.startsWith('bestmove')) {
            const parts = line.split(' ');
            const move = parts[1];
            const ponder = parts[3];
            
            if (move && move !== '(none)') {
                this. onBestMove?.(move, ponder, this._getMultiPVResults());
            }
            return;
        }
        
        // Engine options
        if (line.startsWith('option name')) {
            const option = this._parseOption(line);
            this.onEngineInfo?.({ type: 'option', value: option });
        }
    }

    _parseInfoLine(line) {
        const result = {
            depth: 0,
            seldepth: 0,
            score: 0,
            scoreType: 'cp',
            nodes: 0,
            nps: 0,
            time: 0,
            pv: [],
            multipv: 1,
            hashfull: 0,
            tbhits: 0
        };
        
        // Depth
        const depthMatch = line.match(/depth (\d+)/);
        if (depthMatch) result.depth = parseInt(depthMatch[1]);
        
        // Selective depth
        const seldepthMatch = line.match(/seldepth (\d+)/);
        if (seldepthMatch) result.seldepth = parseInt(seldepthMatch[1]);
        
        // MultiPV index (1-based)
        const multipvMatch = line.match(/multipv (\d+)/);
        if (multipvMatch) result.multipv = parseInt(multipvMatch[1]);
        
        // Score
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        const lowerbound = line.includes('lowerbound');
        const upperbound = line.includes('upperbound');
        
        if (cpMatch) {
            result.score = parseInt(cpMatch[1]) / 100;
            result.scoreType = lowerbound ? 'cp_lower' : upperbound ? 'cp_upper' : 'cp';
        } else if (mateMatch) {
            result.score = parseInt(mateMatch[1]);
            result.scoreType = 'mate';
        }
        
        // Nodes
        const nodesMatch = line.match(/nodes (\d+)/);
        if (nodesMatch) result.nodes = parseInt(nodesMatch[1]);
        
        // NPS
        const npsMatch = line.match(/nps (\d+)/);
        if (npsMatch) result.nps = parseInt(npsMatch[1]);
        
        // Time
        const timeMatch = line.match(/time (\d+)/);
        if (timeMatch) result.time = parseInt(timeMatch[1]);
        
        // Hash usage
        const hashMatch = line. match(/hashfull (\d+)/);
        if (hashMatch) result.hashfull = parseInt(hashMatch[1]) / 10; // Convert to percentage
        
        // Tablebase hits
        const tbMatch = line.match(/tbhits (\d+)/);
        if (tbMatch) result.tbhits = parseInt(tbMatch[1]);
        
        // Principal variation
        const pvMatch = line.match(/ pv (. +)$/);
        if (pvMatch) result.pv = pvMatch[1]. split(' ');
        
        return result;
    }

    _handleAnalysis(analysis) {
        // Track depth changes to clear stale MultiPV data
        if (analysis.depth > this.currentDepth) {
            this.currentDepth = analysis.depth;
            // Don't clear - let new data overwrite
        }
        
        // Store MultiPV line
        this.multiPVLines. set(analysis.multipv, {
            ... analysis,
            timestamp: Date.now()
        });
        
        // Always emit the primary line for backward compatibility
        if (analysis.multipv === 1) {
            this.onAnalysis?.(analysis);
        }
        
        // Emit full MultiPV update
        this.onMultiPVUpdate? .(this._getMultiPVResults());
    }

    _getMultiPVResults() {
        const results = [];
        for (let i = 1; i <= this.multiPVCount; i++) {
            const line = this.multiPVLines.get(i);
            if (line) {
                results. push(line);
            }
        }
        return results. sort((a, b) => a.multipv - b.multipv);
    }

    _parseOption(line) {
        const option = { name: '', type: '', default: null, min: null, max: null, vars: [] };
        
        const nameMatch = line.match(/option name (.+?) type/);
        if (nameMatch) option.name = nameMatch[1];
        
        const typeMatch = line.match(/type (\w+)/);
        if (typeMatch) option.type = typeMatch[1];
        
        const defaultMatch = line. match(/default (\S+)/);
        if (defaultMatch) option.default = defaultMatch[1];
        
        const minMatch = line.match(/min (\d+)/);
        if (minMatch) option.min = parseInt(minMatch[1]);
        
        const maxMatch = line. match(/max (\d+)/);
        if (maxMatch) option.max = parseInt(maxMatch[1]);
        
        const varMatches = line.matchAll(/var (\S+)/g);
        for (const match of varMatches) {
            option.vars.push(match[1]);
        }
        
        return option;
    }

    // ═══════════════════════════════════════════════════════════
    // UCI COMMANDS
    // ═══════════════════════════════════════════════════════════

    send(command) {
        if (this.ws && this.isConnected) {
            this. ws.send(command);
        } else {
            console.warn('[Engine] Cannot send - not connected');
        }
    }

    analyze(fen, options = {}) {
        const {
            depth = 20,
            movetime = null,
            nodes = null,
            multipv = this.multiPVCount
        } = options;
        
        // Stop current analysis
        this.send('stop');
        
        // Clear previous MultiPV data
        this.multiPVLines.clear();
        this.currentDepth = 0;
        
        // Set MultiPV
        if (multipv !== this.multiPVCount) {
            this.setMultiPV(multipv);
        }
        
        // Set position
        this.send(`position fen ${fen}`);
        
        // Build go command
        let goCommand = 'go';
        if (depth) goCommand += ` depth ${depth}`;
        if (movetime) goCommand += ` movetime ${movetime}`;
        if (nodes) goCommand += ` nodes ${nodes}`;
        
        this.send(goCommand);
    }

    analyzeFromMoves(moves, options = {}) {
        this.send('stop');
        this.multiPVLines.clear();
        this.currentDepth = 0;
        
        if (moves && moves.length > 0) {
            this.send(`position startpos moves ${moves.join(' ')}`);
        } else {
            this.send('position startpos');
        }
        
        const { depth = 20, multipv = this.multiPVCount } = options;
        
        if (multipv !== this.multiPVCount) {
            this. setMultiPV(multipv);
        }
        
        this.send(`go depth ${depth}`);
    }

    // Set number of principal variations to analyze
    setMultiPV(count) {
        count = Math.max(1, Math.min(count, 500)); // Clamp to reasonable range
        this. multiPVCount = count;
        this.send(`setoption name MultiPV value ${count}`);
        this.send('isready'); // Wait for option to be applied
    }

    stop() {
        this.send('stop');
    }

    setOption(name, value) {
        this.send(`setoption name ${name} value ${value}`);
    }

    newGame() {
        this.multiPVLines.clear();
        this.currentDepth = 0;
        this.send('ucinewgame');
        this.send('isready');
    }

    // ═══════════════════════════════════════════════════════════
    // ENGINE MANAGEMENT (HTTP API)
    // ═══════════════════════════════════════════════════════════

    async listEngines() {
        try {
            const response = await fetch(`${this.apiUrl}/list_engines`);
            const data = await response.json();
            
            this.availableEngines = data. engines || [];
            this.currentEngine = data.active;
            
            return {
                engines: this.availableEngines,
                active: this.currentEngine
            };
        } catch (error) {
            console.error('[Engine] Failed to list engines:', error);
            return { engines: [], active: null };
        }
    }

    async setEngine(name) {
        try {
            const response = await fetch(`${this.apiUrl}/set_engine/${encodeURIComponent(name)}`);
            const data = await response.json();
            
            if (data.status === 'ok') {
                this.currentEngine = data.active;
                this.multiPVLines.clear();
                console.log('[Engine] Switched to:', this.currentEngine);
                return true;
            } else {
                console.error('[Engine] Failed to set engine:', data.message);
                return false;
            }
        } catch (error) {
            console.error('[Engine] API error:', error);
            return false;
        }
    }

    async checkHealth() {
        try {
            const response = await fetch(`${this.apiUrl}/health`);
            const data = await response.json();
            return data.status === 'online';
        } catch {
            return false;
        }
    }
}
