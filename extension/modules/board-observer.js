// board-observer.js - DOM Watcher & State Extractor
class BoardObserver {
    constructor() {
        this.observer = null;
        this. onBoardChange = null;
        this.boardElement = null;
    }

    attach() {
        // Find the board element (supports multiple chess sites)
        const selectors = [
            'chess-board',           // Chess.com custom element
            'wc-chess-board',        // Chess.com variant
            '. board-b72b1',          // Lichess
            '#board',                // Generic
            '[data-board]'
        ];
        
        for (const sel of selectors) {
            this.boardElement = document.querySelector(sel);
            if (this. boardElement) break;
        }
        
        if (!this.boardElement) {
            console.error('[Overlay] Board element not found');
            return false;
        }

        // Watch for DOM mutations (piece movements)
        this.observer = new MutationObserver((mutations) => {
            // Debounce rapid changes
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => {
                const fen = this.extractFEN();
                if (fen && this.onBoardChange) {
                    this.onBoardChange(fen);
                }
            }, 150);
        });

        this.observer.observe(this.boardElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'transform']
        });
        
        return true;
    }

    extractFEN() {
        // Method 1: Try to hook into the site's game object
        const gameObjects = [
            () => window.game?. fen?. (),                    // Lichess
            () => window.chessboard?.game?.fen(),         // Chess.com
            () => document.querySelector('[data-fen]')?.dataset. fen
        ];
        
        for (const getter of gameObjects) {
            try {
                const fen = getter();
                if (fen) return fen;
            } catch (e) {}
        }
        
        // Method 2: Parse DOM manually (Chess.com style)
        return this._parseDOMToFEN();
    }

    _parseDOMToFEN() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        const pieces = this.boardElement.querySelectorAll('[class*="piece"]');
        
        pieces.forEach(piece => {
            // Parse class like "piece wp square-e2" or "piece bb square-85"
            const classes = piece. className;
            const squareMatch = classes.match(/square-([a-h][1-8]|\d{2})/);
            const pieceMatch = classes.match(/\b([wb][prnbqk])\b/i);
            
            if (squareMatch && pieceMatch) {
                let file, rank;
                const sq = squareMatch[1];
                
                if (sq.length === 2 && isNaN(sq[0])) {
                    // Algebraic:  "e2"
                    file = sq. charCodeAt(0) - 97;
                    rank = parseInt(sq[1]) - 1;
                } else {
                    // Numeric: "85" = file 8, rank 5
                    file = parseInt(sq[0]) - 1;
                    rank = parseInt(sq[1]) - 1;
                }
                
                const pieceCode = pieceMatch[1];
                const fenChar = this._pieceToFEN(pieceCode);
                board[7 - rank][file] = fenChar;
            }
        });
        
        // Convert board array to FEN string
        return board.map(row => {
            let fenRow = '';
            let empty = 0;
            for (const sq of row) {
                if (sq) {
                    if (empty > 0) { fenRow += empty; empty = 0; }
                    fenRow += sq;
                } else {
                    empty++;
                }
            }
            if (empty > 0) fenRow += empty;
            return fenRow;
        }).join('/') + ' w - - 0 1'; // Simplified:  assumes white to move
    }

    _pieceToFEN(code) {
        const map = { 'wp': 'P', 'wn': 'N', 'wb': 'B', 'wr': 'R', 'wq':  'Q', 'wk': 'K',
                      'bp': 'p', 'bn': 'n', 'bb': 'b', 'br': 'r', 'bq': 'q', 'bk': 'k' };
        return map[code.toLowerCase()] || '';
    }

    detach() {
        if (this.observer) this.observer.disconnect();
    }
}
