// engine-wrapper.js - Stockfish Web Worker Manager
class StockfishEngine {
    constructor() {
        this.worker = null;
        this.isReady = false;
        this. onAnalysis = null;
        this.onBestMove = null;
    }

    async init() {
        // Load Stockfish from CDN as a Web Worker
        // Using Blob URL to avoid CORS issues with Tampermonkey
        const stockfishCode = await fetch(
            'https://cdn.jsdelivr.net/npm/stockfish. wasm@0.10.0/stockfish.js'
        ).then(r => r.text());
        
        const blob = new Blob([stockfishCode], { type: 'application/javascript' });
        this.worker = new Worker(URL. createObjectURL(blob));
        
        return new Promise((resolve) => {
            this.worker. onmessage = (e) => this._handleMessage(e. data);
            this.worker. postMessage('uci');
            this.worker.postMessage('isready');
            
            const checkReady = setInterval(() => {
                if (this.isReady) {
                    clearInterval(checkReady);
                    resolve();
                }
            }, 100);
        });
    }

    _handleMessage(line) {
        if (line === 'readyok') {
            this. isReady = true;
        }
        // Parse evaluation:  "info depth 15 score cp 125 ..."
        if (line.includes('info depth') && line.includes('score cp')) {
            const cpMatch = line.match(/score cp (-?\d+)/);
            const depthMatch = line.match(/depth (\d+)/);
            const pvMatch = line.match(/pv (. +)/);
            
            if (cpMatch && this.onAnalysis) {
                this. onAnalysis({
                    score: parseInt(cpMatch[1]) / 100, // Convert centipawns to pawns
                    depth: depthMatch ? parseInt(depthMatch[1]) : 0,
                    pv: pvMatch ? pvMatch[1]. split(' ') : []
                });
            }
        }
        // Parse best move: "bestmove e2e4 ponder e7e5"
        if (line.startsWith('bestmove')) {
            const move = line.split(' ')[1];
            if (this.onBestMove && move !== '(none)') {
                this.onBestMove(move);
            }
        }
    }

    analyze(fen, depth = 18) {
        this.worker.postMessage('stop'); // Stop any previous calculation
        this.worker. postMessage(`position fen ${fen}`);
        this.worker.postMessage(`go depth ${depth}`);
    }

    stop() {
        this.worker. postMessage('stop');
    }
}
