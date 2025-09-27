import { Coord, GameState, InfoResponse, Mode, MoveResponse } from "./types";

export function info(): InfoResponse {
    console.log("INFO");
    return {
        apiversion: "1",
        author: "Nelich",
        color: "#8852c2",
        head: "gamer",
        tail: "mystic-moon",
    };
}

export function start(gameState: GameState): void {
    console.log(`${gameState.game.id} START`);
}

export function end(gameState: GameState): void {
    console.log(`${gameState.game.id} END\n`);
}

// Current mode
export let mode: Mode = Mode.EAT;

// Health threshold to start eating
export let whenToStartEating: number = 40;

// DEFEND persistence
export let defendTurns: number = 0;

// DESPERATE threshold
export let desperateThreshold: number = 20;

// Manhattan distance
function distance(a: Coord, b: Coord): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function move(gameState: GameState): MoveResponse {
    let isMoveSafe: { [key: string]: boolean } = {
        up: true,
        down: true,
        left: true,
        right: true,
    };

    const myHead = gameState.you.head;
    const myNeck = gameState.you.body[1];
    const boardWidth = gameState.board.width;
    const boardHeight = gameState.board.height;

    // Step 0: Don’t move backwards
    if (myNeck.x < myHead.x) isMoveSafe.left = false;
    else if (myNeck.x > myHead.x) isMoveSafe.right = false;
    else if (myNeck.y < myHead.y) isMoveSafe.down = false;
    else if (myNeck.y > myHead.y) isMoveSafe.up = false;

    // Step 1: Prevent out of bounds
    if (myHead.x === 0) isMoveSafe.left = false;
    if (myHead.x === boardWidth - 1) isMoveSafe.right = false;
    if (myHead.y === 0) isMoveSafe.down = false;
    if (myHead.y === boardHeight - 1) isMoveSafe.up = false;

    // Step 2: Prevent colliding with yourself
    gameState.you.body.forEach((segment) => {
        if (myHead.x === segment.x - 1 && myHead.y === segment.y) isMoveSafe.right = false;
        if (myHead.x === segment.x + 1 && myHead.y === segment.y) isMoveSafe.left = false;
        if (myHead.y === segment.y - 1 && myHead.x === segment.x) isMoveSafe.up = false;
        if (myHead.y === segment.y + 1 && myHead.x === segment.x) isMoveSafe.down = false;
    });

    // Step 3: Prevent collisions with other snakes’ bodies
    gameState.board.snakes.forEach((snake) => {
        snake.body.forEach((segment) => {
            if (myHead.x === segment.x - 1 && myHead.y === segment.y) isMoveSafe.right = false;
            if (myHead.x === segment.x + 1 && myHead.y === segment.y) isMoveSafe.left = false;
            if (myHead.y === segment.y - 1 && myHead.x === segment.x) isMoveSafe.up = false;
            if (myHead.y === segment.y + 1 && myHead.x === segment.x) isMoveSafe.down = false;
        });
    });

    // Collect safe moves
    const safeMoves = Object.keys(isMoveSafe).filter((key) => isMoveSafe[key]);
    if (safeMoves.length === 0) {
        console.log(`MOVE ${gameState.turn}: No safe moves detected! Moving down`);
        return { move: "down" };
    }

    let nextMove = safeMoves[Math.floor(Math.random() * safeMoves.length)];

    // --- DESPERATE MODE ---
    if (gameState.you.health < desperateThreshold) {
        mode = Mode.EAT; // DESPERATE behaves like EAT but with higher priority
        // Go straight for closest food ignoring other modes
        const food = gameState.board.food;
        let closestFood: Coord | undefined;
        let minDistance = Infinity;

        food.forEach((f) => {
            const d = distance(myHead, f);
            if (d < minDistance) {
                minDistance = d;
                closestFood = f;
            }
        });

        if (closestFood) {
            const preferredMoves: string[] = [];
            if (myHead.x < closestFood.x) preferredMoves.push("right");
            else if (myHead.x > closestFood.x) preferredMoves.push("left");
            if (myHead.y < closestFood.y) preferredMoves.push("up");
            else if (myHead.y > closestFood.y) preferredMoves.push("down");

            const safePreferredMoves = preferredMoves.filter((m) => safeMoves.includes(m));
            if (safePreferredMoves.length > 0) {
                nextMove = safePreferredMoves[Math.floor(Math.random() * safePreferredMoves.length)];
            }
        }

        console.log(`MOVE ${gameState.turn}: ${nextMove} (DESPERATE)`);
        return { move: nextMove };
    }

    // --- Mode Switching ---
    // Default by health
    if (gameState.you.health < whenToStartEating) {
        mode = Mode.EAT;
    } else {
        mode = Mode.WALL_HUG;
    }

    // Check if enemy snake is nearby → DEFEND
    let closestEnemyDist = Infinity;
    let closestEnemy: Coord | undefined;

    gameState.board.snakes.forEach((snake) => {
        if (snake.id !== gameState.you.id) {
            const d = distance(myHead, snake.head);
            if (d < closestEnemyDist) {
                closestEnemyDist = d;
                closestEnemy = snake.head;
            }
        }
    });

    // DEFEND priority
    if ((closestEnemy && closestEnemyDist <= 2) || defendTurns > 0) {
        mode = Mode.DEFEND;
        defendTurns = 2; // persist DEFEND for 2 turns
    }

    // --- Mode Behaviors ---
    if (mode === Mode.WALL_HUG) {
        let preferred: string | undefined;

        // If not touching wall → move toward nearest wall
        if (myHead.x > 0 && myHead.x < boardWidth - 1 && myHead.y > 0 && myHead.y < boardHeight - 1) {
            const distLeft = myHead.x;
            const distRight = boardWidth - 1 - myHead.x;
            const distDown = myHead.y;
            const distUp = boardHeight - 1 - myHead.y;
            const minDist = Math.min(distLeft, distRight, distDown, distUp);

            if (minDist === distLeft && safeMoves.includes("left")) preferred = "left";
            else if (minDist === distRight && safeMoves.includes("right")) preferred = "right";
            else if (minDist === distDown && safeMoves.includes("down")) preferred = "down";
            else if (minDist === distUp && safeMoves.includes("up")) preferred = "up";
        } else {
            // Already hugging → follow clockwise
            if (myHead.x === 0) preferred = safeMoves.includes("up") ? "up" : undefined;
            else if (myHead.y === boardHeight - 1) preferred = safeMoves.includes("right") ? "right" : undefined;
            else if (myHead.x === boardWidth - 1) preferred = safeMoves.includes("down") ? "down" : undefined;
            else if (myHead.y === 0) preferred = safeMoves.includes("left") ? "left" : undefined;
        }

        if (preferred && safeMoves.includes(preferred)) nextMove = preferred;
        else nextMove = safeMoves[Math.floor(Math.random() * safeMoves.length)]; // fallback
    }

    if (mode === Mode.EAT) {
        const food = gameState.board.food;
        let closestFood: Coord | undefined;
        let minDistance = Infinity;

        food.forEach((f) => {
            const d = distance(myHead, f);
            if (d < minDistance) {
                minDistance = d;
                closestFood = f;
            }
        });

        if (closestFood) {
            const preferredMoves: string[] = [];
            if (myHead.x < closestFood.x) preferredMoves.push("right");
            else if (myHead.x > closestFood.x) preferredMoves.push("left");
            if (myHead.y < closestFood.y) preferredMoves.push("up");
            else if (myHead.y > closestFood.y) preferredMoves.push("down");

            const safePreferredMoves = preferredMoves.filter((m) => safeMoves.includes(m));
            if (safePreferredMoves.length > 0) {
                nextMove = safePreferredMoves[Math.floor(Math.random() * safePreferredMoves.length)];
            }
        }
    }

    if (mode === Mode.DEFEND && closestEnemy) {
        // Pick moves that increase distance from enemy head
        const moveOptions: { [key: string]: Coord } = {
            up: { x: myHead.x, y: myHead.y + 1 },
            down: { x: myHead.x, y: myHead.y - 1 },
            left: { x: myHead.x - 1, y: myHead.y },
            right: { x: myHead.x + 1, y: myHead.y },
        };

        let bestMove = nextMove;
        let maxDist = -1;

        safeMoves.forEach((m) => {
            const pos = moveOptions[m];
            const d = distance(pos, closestEnemy!);
            if (d > maxDist) {
                maxDist = d;
                bestMove = m;
            }
        });

        nextMove = bestMove;
        defendTurns--; // decrement persistence
    }

    console.log(`MOVE ${gameState.turn}: ${nextMove} (${mode})`);
    return { move: nextMove };
}
