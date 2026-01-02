// input-mouse-click.js - Realistic Mouse Event Simulation
class MouseClickMover {
    constructor(boardElement) {
        this.board = boardElement;
        this.config = {
            // Timing randomization (milliseconds)
            clickDelay: { min: 30, max: 80 },
            moveDelay: { min: 80, max: 200 },
            promotionDelay: { min: 150, max: 300 },
            
            // Position randomization (pixels from center)
            positionJitter: 8,
            
            // Enable drag vs click-click
            useDragMethod: false
        };
    }

    async playMove(move) {
        if (!move || move.length < 4) return false;
        
        const from = move.slice(0, 2);
        const to = move. slice(2, 4);
        const promotion = move[4];
        
        const fromEl = this._getSquareElement(from);
        const toEl = this._getSquareElement(to);
        
        if (! fromEl || !toEl) {
            console.warn('[MouseClick] Squares not found:', from, to);
            return false;
        }

        if (this.config.useDragMethod) {
            await this._dragPiece(fromEl, toEl);
        } else {
            await this._clickClick(fromEl, toEl);
        }

        // Handle pawn promotion
        if (promotion) {
            await this._delay(this.config.promotionDelay);
            await this._selectPromotion(promotion);
        }

        return true;
    }

    // Click-Click Method:  Click source, then click destination
    async _clickClick(fromEl, toEl) {
        // Click on source square (select piece)
        await this._performClick(fromEl);
        
        // Wait between clicks
        await this._delay(this.config.moveDelay);
        
        // Click on destination square (make move)
        await this._performClick(toEl);
    }

    // Drag Method:  Mousedown on source, move, mouseup on destination
    async _dragPiece(fromEl, toEl) {
        const fromPos = this._getElementCenter(fromEl);
        const toPos = this._getElementCenter(toEl);
        
        // Mousedown on source
        this._dispatchMouseEvent(fromEl, 'mousedown', fromPos);
        await this._delay(this.config. clickDelay);
        
        // Simulate drag movement (optional intermediate points)
        const steps = 5;
        for (let i = 1; i <= steps; i++) {
            const progress = i / steps;
            const currentPos = {
                x: fromPos.x + (toPos.x - fromPos.x) * progress,
                y: fromPos.y + (toPos.y - fromPos.y) * progress
            };
            this._dispatchMouseEvent(document.body, 'mousemove', currentPos);
            await this._delay({ min: 10, max: 20 });
        }
        
        // Mouseup on destination
        this._dispatchMouseEvent(toEl, 'mouseup', toPos);
        await this._delay(this.config.clickDelay);
        
        // Some sites need a final click
        this._dispatchMouseEvent(toEl, 'click', toPos);
    }

    async _performClick(element) {
        const pos = this._getElementCenter(element);
        
        // Full click sequence:  down → up → click
        this._dispatchMouseEvent(element, 'mousedown', pos);
        await this._delay(this. config.clickDelay);
        
        this._dispatchMouseEvent(element, 'mouseup', pos);
        await this._delay({ min: 5, max: 15 });
        
        this._dispatchMouseEvent(element, 'click', pos);
    }

    _dispatchMouseEvent(element, type, pos) {
        // Add realistic jitter
        const jitter = this.config.positionJitter;
        const x = pos.x + (Math.random() - 0.5) * jitter;
        const y = pos.y + (Math.random() - 0.5) * jitter;
        
        const event = new MouseEvent(type, {
            view: window,
            bubbles:  true,
            cancelable: true,
            
            // Position data
            clientX: x,
            clientY: y,
            screenX: x + window.screenX,
            screenY: y + window.screenY,
            pageX: x + window.scrollX,
            pageY: y + window.scrollY,
            
            // Button state
            button: 0,           // Left click
            buttons: type === 'mousedown' ? 1 : 0,
            
            // Modifiers (none)
            ctrlKey: false,
            shiftKey: false,
            altKey: false,
            metaKey: false,
            
            // Pointer properties
            relatedTarget: null,
            detail: type === 'click' ? 1 : 0
        });
        
        // Prevent detection of synthetic events
        Object.defineProperty(event, 'isTrusted', {
            get: () => true
        });
        
        element. dispatchEvent(event);
    }

    _getElementCenter(element) {
        const rect = element.getBoundingClientRect();
        return {
            x:  rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    _getSquareElement(square) {
        // Multiple selector strategies for different sites
        const selectors = [
            `[data-square="${square}"]`,                    // Common
            `.square-${square}`,                            // Chess.com
            `[data-square-coord="${square}"]`,              // Lichess
            `.square[data-coord="${square}"]`,              // Generic
            `#board-square-${square}`,                      // ID-based
        ];
        
        for (const sel of selectors) {
            const el = this.board.querySelector(sel);
            if (el) return el;
        }
        
        // Fallback: Calculate position and find element at coordinates
        return this._findSquareByPosition(square);
    }

    _findSquareByPosition(square) {
        const boardRect = this.board.getBoundingClientRect();
        const squareSize = boardRect.width / 8;
        
        // Check if board is flipped
        const isFlipped = this.board.classList.contains('flipped') ||
                          this.board. dataset.orientation === 'black';
        
        let fileIndex = square.charCodeAt(0) - 97; // a=0, h=7
        let rankIndex = parseInt(square[1]) - 1;   // 1=0, 8=7
        
        if (isFlipped) {
            fileIndex = 7 - fileIndex;
            rankIndex = 7 - rankIndex;
        }
        
        const x = boardRect.left + (fileIndex + 0.5) * squareSize;
        const y = boardRect.top + ((7 - rankIndex) + 0.5) * squareSize;
        
        return document.elementFromPoint(x, y);
    }

    async _selectPromotion(piece) {
        const pieceNames = {
            'q': ['queen', 'q'],
            'r': ['rook', 'r'],
            'b': ['bishop', 'b'],
            'n': ['knight', 'n']
        };
        
        const names = pieceNames[piece.toLowerCase()] || ['queen', 'q'];
        
        // Find promotion dialog element
        const selectors = names.flatMap(name => [
            `[data-piece="${name}"]`,
            `.promotion-piece. ${name}`,
            `[class*="promotion"][class*="${name}"]`,
            `.promote-${name[0]}`,
            `[data-promo="${name[0]}"]`
        ]);
        
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                await this._performClick(el);
                return true;
            }
        }
        
        console.warn('[MouseClick] Promotion element not found for:', piece);
        return false;
    }

    _delay(config) {
        const ms = typeof config === 'number' 
            ? config 
            : config.min + Math.random() * (config.max - config.min);
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
