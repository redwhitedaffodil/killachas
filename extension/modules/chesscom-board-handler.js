// chesscom-board-handler.js - Chess. com Specific Board Handler
class ChessComBoardHandler {
    constructor() {
        this.board = null;
        this.pieceMap = {
            'wp': 'P', 'wn': 'N', 'wb': 'B', 'wr': 'R', 'wq': 'Q', 'wk': 'K',
            'bp': 'p', 'bn': 'n', 'bb': 'b', 'br': 'r', 'bq': 'q', 'bk':  'k'
        };
    }

    attach() {
        // Find Chess.com board element
        this. board = document.querySelector('wc-chess-board') ||
                     document.querySelector('chess-board');
        
        if (!this. board) {
            console.error('[ChessCom] Board not found');
            return false;
        }
        
        console.log('[ChessCom] Board attached:', this.board.id);
        return true;
    }

    // ═══════════════════════════════════════════════════════════
    // COORDINATE CONVERSION
    // ═══════════════════════════════════════════════════════════
    
    // Chess.com numeric (e.g., "51") → Algebraic (e.g., "e1")
    numericToAlgebraic(numeric) {
        const file = String. fromCharCode(96 + parseInt(numeric[0])); // 1→a, 8→h
        const rank = numeric[1];
        return file + rank;
    }

    // Algebraic (e.g., "e4") → Chess.com numeric (e.g., "54")
    algebraicToNumeric(algebraic) {
        const file = algebraic. charCodeAt(0) - 96; // a→1, h→8
        const rank = algebraic[1];
        return `${file}${rank}`;
    }

    // ═══════════════════════════════════════════════════════════
    // STATE EXTRACTION
    // ═══════════════════════════════════════════════════════════

    extractFEN() {
        // Initialize empty 8x8 board
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // Find all piece elements
        const pieces = this.board.querySelectorAll('.piece');
        
        pieces.forEach(piece => {
            const classes = piece.className.split(' ');
            
            // Find piece type (wp, bn, br, etc.)
            const pieceType = classes.find(c => /^[wb][pnbrqk]$/.test(c));
            
            // Find square (square-XY format)
            const squareClass = classes.find(c => c.startsWith('square-'));
            
            if (pieceType && squareClass) {
                const numeric = squareClass.replace('square-', '');
                const file = parseInt(numeric[0]) - 1; // 0-7
                const rank = parseInt(numeric[1]) - 1; // 0-7
                
                board[7 - rank][file] = this.pieceMap[pieceType];
            }
        });

        // Convert board array to FEN
        const fenRows = board.map(row => {
            let fenRow = '';
            let emptyCount = 0;
            
            for (const square of row) {
                if (square) {
                    if (emptyCount > 0) {
                        fenRow += emptyCount;
                        emptyCount = 0;
                    }
                    fenRow += square;
                } else {
                    emptyCount++;
                }
            }
            
            if (emptyCount > 0) fenRow += emptyCount;
            return fenRow;
        }).join('/');

        // Note: This is a simplified FEN (position only)
        // Full FEN requires:  turn, castling, en passant, halfmove, fullmove
        return fenRows + ' w KQkq - 0 1';
    }

    // Try to get full FEN from Chess.com's game object
    extractFullFEN() {
        try {
            // Chess.com stores game state in various places
            const sources = [
                () => this.board.game?. getFEN?. (),
                () => this.board.game?. fen,
                () => window.game?.getFEN?.(),
                () => window.game?.fen,
                () => document.querySelector('. move-list')
                    ? .__vue__?.game?. fen,
            ];
            
            for (const source of sources) {
                const fen = source();
                if (fen) return fen;
            }
        } catch (e) {}
        
        // Fallback to DOM parsing
        return this.extractFEN();
    }

    // ═══════════════════════════════════════════════════════════
    // TELEPORT MOVE METHOD
    // ═══════════════════════════════════════════════════════════

    teleportMove(move) {
        // move format: "e2e4" or "e7e8q" (with promotion)
        const from = move.slice(0, 2);
        const to = move.slice(2, 4);
        const promotion = move[4];

        const fromNumeric = this.algebraicToNumeric(from);
        const toNumeric = this. algebraicToNumeric(to);

        // Find the piece to move
        const pieceEl = this.board.querySelector(`.piece.square-${fromNumeric}`);
        if (!pieceEl) {
            console.error('[ChessCom] No piece found on', from);
            return false;
        }

        // Remove captured piece (if any)
        const capturedPiece = this.board.querySelector(`.piece.square-${toNumeric}`);
        if (capturedPiece && capturedPiece !== pieceEl) {
            capturedPiece.remove();
        }

        // Move the piece by changing class
        pieceEl.classList.remove(`square-${fromNumeric}`);
        pieceEl.classList. add(`square-${toNumeric}`);

        // Handle promotion
        if (promotion) {
            const color = pieceEl.classList.contains('wp') ? 'w' : 'b';
            pieceEl.classList.remove(`${color}p`);
            pieceEl.classList.add(`${color}${promotion}`);
        }

        console.log('[ChessCom] Teleported:', move);
        return true;
    }

    // ═══════════════════════════════════════════════════════════
    // MOUSE CLICK MOVE METHOD
    // ═══════════════════════════════════════════════════════════

    async mouseClickMove(move) {
        const from = move.slice(0, 2);
        const to = move.slice(2, 4);
        const promotion = move[4];

        const fromNumeric = this.algebraicToNumeric(from);
        const toNumeric = this.algebraicToNumeric(to);

        // Get board dimensions
        const boardRect = this. board.getBoundingClientRect();
        const squareSize = boardRect.width / 8;

        // Check if board is flipped (playing as black)
        const isFlipped = this.board.classList. contains('flipped');

        // Calculate pixel positions
        const getSquareCenter = (numeric) => {
            let file = parseInt(numeric[0]) - 1; // 0-7
            let rank = parseInt(numeric[1]) - 1; // 0-7

            if (isFlipped) {
                file = 7 - file;
                rank = 7 - rank;
            }

            return {
                x: boardRect.left + (file + 0.5) * squareSize,
                y: boardRect.top + (7 - rank + 0.5) * squareSize
            };
        };

        const fromPos = getSquareCenter(fromNumeric);
        const toPos = getSquareCenter(toNumeric);

        // Click on source square
        await this._simulateClick(fromPos);
        await this._delay(100, 180);

        // Click on destination square
        await this._simulateClick(toPos);

        // Handle promotion
        if (promotion) {
            await this._delay(200, 350);
            await this._clickPromotion(promotion);
        }

        console. log('[ChessCom] Mouse clicked:', move);
        return true;
    }

    async _simulateClick(pos) {
        // Add slight randomization
        const jitter = 5;
        const x = pos. x + (Math.random() - 0.5) * jitter;
        const y = pos.y + (Math.random() - 0.5) * jitter;

        const eventProps = {
            view: window,
            bubbles:  true,
            cancelable: true,
            clientX: x,
            clientY: y,
            screenX: x + window.screenX,
            screenY: y + window.screenY,
            button: 0
        };

        const target = document.elementFromPoint(x, y) || this.board;

        // Mousedown
        target.dispatchEvent(new MouseEvent('mousedown', {
            ...eventProps,
            buttons: 1
        }));

        await this._delay(30, 60);

        // Mouseup
        target.dispatchEvent(new MouseEvent('mouseup', {
            ...eventProps,
            buttons: 0
        }));

        // Click
        target.dispatchEvent(new MouseEvent('click', eventProps));
    }

    async _clickPromotion(piece) {
        // Chess.com promotion dialog uses specific selectors
        const pieceSelectors = {
            'q': '[data-piece="wq"], [data-piece="bq"], . promotion-piece-q',
            'r': '[data-piece="wr"], [data-piece="br"], .promotion-piece-r',
            'b': '[data-piece="wb"], [data-piece="bb"], . promotion-piece-b',
            'n': '[data-piece="wn"], [data-piece="bn"], .promotion-piece-n'
        };

        const selector = pieceSelectors[piece. toLowerCase()];
        const promoEl = document.querySelector(selector);

        if (promoEl) {
            const rect = promoEl.getBoundingClientRect();
            await this._simulateClick({
                x: rect.left + rect. width / 2,
                y: rect.top + rect.height / 2
            });
        }
    }

    _delay(min, max) {
        const ms = min + Math.random() * (max - min);
        return new Promise(r => setTimeout(r, ms));
    }

    // ═══════════════════════════════════════════════════════════
    // VISUAL OVERLAY (Highlights & Arrows)
    // ═══════════════════════════════════════════════════════════

    highlightSquare(square, color = 'rgb(0, 184, 148)', opacity = 0.6) {
        const numeric = this.algebraicToNumeric(square);
        
        // Remove existing highlight on this square
        this.clearHighlight(square);

        const highlight = document.createElement('div');
        highlight.className = `highlight square-${numeric} ck-overlay-highlight`;
        highlight.style.cssText = `
            background-color: ${color};
            opacity: ${opacity};
        `;
        highlight.dataset.testElement = 'highlight';

        // Insert after coordinates SVG
        const coordsSvg = this.board.querySelector('svg. coordinates');
        if (coordsSvg) {
            coordsSvg.after(highlight);
        } else {
            this.board.prepend(highlight);
        }

        return highlight;
    }

    highlightMove(move, fromColor = 'rgb(0, 184, 148)', toColor = 'rgb(0, 206, 201)') {
        if (!move || move.length < 4) return;

        const from = move.slice(0, 2);
        const to = move.slice(2, 4);

        this.highlightSquare(from, fromColor, 0.5);
        this.highlightSquare(to, toColor, 0.7);
    }

    clearHighlight(square) {
        if (square) {
            const numeric = this. algebraicToNumeric(square);
            const existing = this.board.querySelector(
                `.ck-overlay-highlight.square-${numeric}`
            );
            if (existing) existing.remove();
        } else {
            // Clear all overlay highlights
            this.board.querySelectorAll('. ck-overlay-highlight')
                .forEach(el => el.remove());
        }
    }

    drawArrow(from, to, color = 'rgb(0, 184, 148)', opacity = 0.8) {
        const arrowsSvg = this.board.querySelector('svg.arrows');
        if (!arrowsSvg) return null;

        const arrowId = `arrow-${from}${to}-overlay`;
        
        // Remove existing arrow with same endpoints
        const existing = arrowsSvg.querySelector(`#${arrowId}`);
        if (existing) existing.remove();

        // Calculate arrow geometry (simplified)
        const fromNumeric = this.algebraicToNumeric(from);
        const toNumeric = this.algebraicToNumeric(to);

        const fromFile = parseInt(fromNumeric[0]);
        const fromRank = parseInt(fromNumeric[1]);
        const toFile = parseInt(toNumeric[0]);
        const toRank = parseInt(toNumeric[1]);

        // Chess.com uses 100x100 viewBox, each square is 12.5 units
        const fromX = (fromFile - 0.5) * 12.5;
        const fromY = (8. 5 - fromRank) * 12.5;
        const toX = (toFile - 0.5) * 12.5;
        const toY = (8.5 - toRank) * 12.5;

        // Create line arrow (simplified, Chess.com uses polygons)
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        arrow.id = arrowId;
        arrow.setAttribute('x1', fromX);
        arrow.setAttribute('y1', fromY);
        arrow.setAttribute('x2', toX);
        arrow.setAttribute('y2', toY);
        arrow.setAttribute('stroke', color);
        arrow.setAttribute('stroke-width', '2.5');
        arrow.setAttribute('stroke-linecap', 'round');
        arrow.setAttribute('marker-end', 'url(#arrowhead)');
        arrow.style.opacity = opacity;

        arrowsSvg.appendChild(arrow);
        return arrow;
    }

    clearArrows() {
        const arrowsSvg = this.board.querySelector('svg.arrows');
        if (arrowsSvg) {
            arrowsSvg.querySelectorAll('[id$="-overlay"]')
                .forEach(el => el.remove());
        }
    }
}
