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

export let mode: Mode = Mode.EAT;
export let wallHugUntil: boolean = false;
export let hpThreshold: number = 50;

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

    // Step 0: Don’t move backwards
    if (myNeck.x < myHead.x) isMoveSafe.left = false;
    else if (myNeck.x > myHead.x) isMoveSafe.right = false;
    else if (myNeck.y < myHead.y) isMoveSafe.down = false;
    else if (myNeck.y > myHead.y) isMoveSafe.up = false;

    // Step 1: Prevent out of bounds
    const boardWidth = gameState.board.width;
    const boardHeight = gameState.board.height;

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

    // --- Mode Switching ---
    // If health < 50 → force EAT until >= 70
    if (gameState.you.health < 50 && !wallHugUntil) {
        mode = Mode.EAT;
        wallHugUntil = true;
    } else if (wallHugUntil && gameState.you.health >= hpThreshold) {
        wallHugUntil = false;
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

    if (closestEnemy && closestEnemyDist <= 2) {
        mode = Mode.DEFEND;
    }

    // --- Mode Behaviors ---
    if (mode === Mode.WALL_HUG) {
        // If not touching wall → move toward nearest wall
        if (myHead.x > 0 && myHead.x < boardWidth - 1 && myHead.y > 0 && myHead.y < boardHeight - 1) {
            const distLeft = myHead.x;
            const distRight = boardWidth - 1 - myHead.x;
            const distDown = myHead.y;
            const distUp = boardHeight - 1 - myHead.y;
            const minDist = Math.min(distLeft, distRight, distDown, distUp);

            if (minDist === distLeft && safeMoves.includes("left")) nextMove = "left";
            else if (minDist === distRight && safeMoves.includes("right")) nextMove = "right";
            else if (minDist === distDown && safeMoves.includes("down")) nextMove = "down";
            else if (minDist === distUp && safeMoves.includes("up")) nextMove = "up";
        } else {
            // Already hugging → follow clockwise
            if (myHead.x === 0 && safeMoves.includes("up")) nextMove = "up";
            else if (myHead.y === boardHeight - 1 && safeMoves.includes("right")) nextMove = "right";
            else if (myHead.x === boardWidth - 1 && safeMoves.includes("down")) nextMove = "down";
            else if (myHead.y === 0 && safeMoves.includes("left")) nextMove = "left";
        }
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
    }

    console.log(`MOVE ${gameState.turn}: ${nextMove} (${mode})`);
    return { move: nextMove };
}
