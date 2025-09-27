import {Coord, GameState, InfoResponse, Mode, MoveResponse} from "./types";

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

// Default mode
export let mode: Mode = Mode.EAT;

// Health threshold to leave food-hunting mode
export const hpThreshold: number = 70;

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
    if (myNeck.x < myHead.x) {
        isMoveSafe.left = false;
    } else if (myNeck.x > myHead.x) {
        isMoveSafe.right = false;
    } else if (myNeck.y < myHead.y) {
        isMoveSafe.down = false;
    } else if (myNeck.y > myHead.y) {
        isMoveSafe.up = false;
    }

    // Step 1: Prevent out of bounds
    const boardWidth = gameState.board.width;
    const boardHeight = gameState.board.height;

    if (myHead.x === 0) isMoveSafe.left = false;
    if (myHead.x === boardWidth - 1) isMoveSafe.right = false;
    if (myHead.y === 0) isMoveSafe.down = false;
    if (myHead.y === boardHeight - 1) isMoveSafe.up = false;

    // Step 2: Prevent colliding with yourself
    gameState.you.body.forEach((segment) => {
        if (myHead.x === segment.x - 1 && myHead.y === segment.y) {
            isMoveSafe.right = false;
        }
        if (myHead.x === segment.x + 1 && myHead.y === segment.y) {
            isMoveSafe.left = false;
        }
        if (myHead.y === segment.y - 1 && myHead.x === segment.x) {
            isMoveSafe.up = false;
        }
        if (myHead.y === segment.y + 1 && myHead.x === segment.x) {
            isMoveSafe.down = false;
        }
    });

    // TODO Step 3: Prevent collisions with other snakes

    // Collect safe moves
    const safeMoves = Object.keys(isMoveSafe).filter((key) => isMoveSafe[key]);
    if (safeMoves.length === 0) {
        console.log(`MOVE ${gameState.turn}: No safe moves detected! Moving down`);
        return { move: "down" };
    }

    let nextMove = safeMoves[Math.floor(Math.random() * safeMoves.length)];

    // Mode switching with hysteresis
    if (mode === Mode.WALL_HUG && gameState.you.health < 50) {
        mode = Mode.EAT;
    }
    if (mode === Mode.EAT && gameState.you.health >= hpThreshold) {
        mode = Mode.WALL_HUG;
    }

    // WALL_HUG mode
    if (mode === Mode.WALL_HUG) {
        // If NOT touching a wall → move toward the nearest wall first
        if (myHead.x > 0 && myHead.x < boardWidth - 1 &&
            myHead.y > 0 && myHead.y < boardHeight - 1) {

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
            // Already on a wall → follow perimeter clockwise
            if (myHead.x === 0 && safeMoves.includes("up")) nextMove = "up";
            else if (myHead.y === boardHeight - 1 && safeMoves.includes("right")) nextMove = "right";
            else if (myHead.x === boardWidth - 1 && safeMoves.includes("down")) nextMove = "down";
            else if (myHead.y === 0 && safeMoves.includes("left")) nextMove = "left";
        }
    }

    // EAT mode
    if (mode === Mode.EAT) {
        const food = gameState.board.food;
        let closestFood: Coord | undefined;
        let minDistance = Infinity;

        food.forEach((f) => {
            const distance = Math.abs(myHead.x - f.x) + Math.abs(myHead.y - f.y);
            if (distance < minDistance) {
                minDistance = distance;
                closestFood = f;
            }
        });

        if (closestFood !== undefined) {
            const preferredMoves: string[] = [];
            if (myHead.x < closestFood.x) preferredMoves.push("right");
            else if (myHead.x > closestFood.x) preferredMoves.push("left");
            if (myHead.y < closestFood.y) preferredMoves.push("up");
            else if (myHead.y > closestFood.y) preferredMoves.push("down");

            const safePreferredMoves = preferredMoves.filter((move) =>
                safeMoves.includes(move)
            );
            if (safePreferredMoves.length > 0) {
                nextMove =
                    safePreferredMoves[
                        Math.floor(Math.random() * safePreferredMoves.length)
                        ];
            }
        }
    }

    console.log(`MOVE ${gameState.turn}: ${nextMove} (${mode})`);
    return { move: nextMove };
}
