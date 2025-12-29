import { BinaryExpression, Equation, Expression, exprToString, parse, NumberLiteral, Variable } from "./parser.js";
import { tokenize } from "./tokenizer.js";

// Store the last solution tree for visualization
let lastSolutionTree: any = null;

export function getSolutionTree() {
    return lastSolutionTree;
}

interface TreeNode {
    expr: string;
    children: TreeNode[];
    isSolution: boolean;
    timedOut?: boolean;
}

function treeToVisualizationFormat(node: SolutionTree, timedOut: boolean = false): TreeNode {
    return {
        expr: exprToString(node.expr),
        children: node.children.map(child => treeToVisualizationFormat(child, timedOut)),
        isSolution: isRealSolution(node.expr),
        timedOut: timedOut
    };
}

export function simplify(expr: Equation | Expression): Equation | Expression {
    // Use fixed-point iteration to ensure complete simplification
    let current = expr;
    let previous: string;
    
    do {
        previous = exprToString(current);
        current = simplifyOnce(current);
    } while (exprToString(current) !== previous);
    
    return current;
}

function simplifyOnce(expr: Equation | Expression): Equation | Expression {
    if (expr.type === "Equation") {
        const eq = expr as Equation;
        return {
            type: "Equation",
            left: simplifyOnce(eq.left),
            right: simplifyOnce(eq.right)
        } as Equation;
    }

    if (expr.type === "BinaryExpression") {
        const binExpr = expr as BinaryExpression;
        const left = simplifyOnce(binExpr.left);
        const right = simplifyOnce(binExpr.right);

        // Handle constant folding: combine two number literals
        if (left.type === "NumberLiteral" && right.type === "NumberLiteral") {
            const leftVal = (left as NumberLiteral).value;
            const rightVal = (right as NumberLiteral).value;
            let result: number;

            switch (binExpr.operator) {
                case "+":
                    result = leftVal + rightVal;
                    break;
                case "-":
                    result = leftVal - rightVal;
                    break;
                case "*":
                    result = leftVal * rightVal;
                    break;
                case "/":
                    result = leftVal / rightVal;
                    break;
                default:
                    return {
                        type: "BinaryExpression",
                        operator: binExpr.operator,
                        left,
                        right
                    } as BinaryExpression;
            }

            return {
                type: "NumberLiteral",
                value: result
            } as NumberLiteral;
        }

        // Handle identity elements and absorbing elements
        // x + 0 = x, 0 + x = x
        if (binExpr.operator === "+" && right.type === "NumberLiteral" && (right as NumberLiteral).value === 0) {
            return left;
        }
        if (binExpr.operator === "+" && left.type === "NumberLiteral" && (left as NumberLiteral).value === 0) {
            return right;
        }

        // x - 0 = x
        if (binExpr.operator === "-" && right.type === "NumberLiteral" && (right as NumberLiteral).value === 0) {
            return left;
        }

        // x * 1 = x, 1 * x = x
        if (binExpr.operator === "*" && right.type === "NumberLiteral" && (right as NumberLiteral).value === 1) {
            return left;
        }
        if (binExpr.operator === "*" && left.type === "NumberLiteral" && (left as NumberLiteral).value === 1) {
            return right;
        }

        // x * 0 = 0, 0 * x = 0
        if (binExpr.operator === "*" && right.type === "NumberLiteral" && (right as NumberLiteral).value === 0) {
            return { type: "NumberLiteral", value: 0 } as NumberLiteral;
        }
        if (binExpr.operator === "*" && left.type === "NumberLiteral" && (left as NumberLiteral).value === 0) {
            return { type: "NumberLiteral", value: 0 } as NumberLiteral;
        }

        // x / 1 = x
        if (binExpr.operator === "/" && right.type === "NumberLiteral" && (right as NumberLiteral).value === 1) {
            return left;
        }

        // Handle like terms addition: var + var = 2 * var
        if (binExpr.operator === "+" && left.type === "Variable" && right.type === "Variable") {
            const leftVar = left as Variable;
            const rightVar = right as Variable;
            if (leftVar.name === rightVar.name) {
                return {
                    type: "BinaryExpression",
                    operator: "*",
                    left: { type: "NumberLiteral", value: 2 } as NumberLiteral,
                    right: left
                } as BinaryExpression;
            }
        }

        // Handle multiplicative cancellation: (a * n) / n = a, (a / n) * n = a, (n * a) / n = a, n * (a / n) = a
        if (left.type === "BinaryExpression" && right.type === "NumberLiteral") {
            const leftBin = left as BinaryExpression;
            const rightVal = (right as NumberLiteral).value;

            // Pattern: (a * n) / n = a
            if (binExpr.operator === "/" && leftBin.operator === "*") {
                if (leftBin.right.type === "NumberLiteral" && (leftBin.right as NumberLiteral).value === rightVal) {
                    return leftBin.left;
                }
                // Pattern: (n * a) / n = a
                if (leftBin.left.type === "NumberLiteral" && (leftBin.left as NumberLiteral).value === rightVal) {
                    return leftBin.right;
                }
            }

            // Pattern: (a / n) * n = a
            if (binExpr.operator === "*" && leftBin.operator === "/" && rightVal !== 0) {
                if (leftBin.right.type === "NumberLiteral" && (leftBin.right as NumberLiteral).value === rightVal) {
                    return leftBin.left;
                }
            }
        }

        // Handle cancellation with right-side binary expression: n * (a / n) = a
        if (left.type === "NumberLiteral" && right.type === "BinaryExpression") {
            const leftVal = (left as NumberLiteral).value;
            const rightBin = right as BinaryExpression;

            // Pattern: n * (a / n) = a
            if (binExpr.operator === "*" && rightBin.operator === "/" && leftVal !== 0) {
                if (rightBin.right.type === "NumberLiteral" && (rightBin.right as NumberLiteral).value === leftVal) {
                    return rightBin.left;
                }
            }
        }

        // Handle additive cancellation: (a + b) - b = a, (a - b) + b = a
        if (left.type === "BinaryExpression") {
            const leftBin = left as BinaryExpression;
            
            // Helper function to check if two expressions are equal
            const exprsEqual = (expr1: Expression, expr2: Expression): boolean => {
                if (expr1.type !== expr2.type) return false;
                if (expr1.type === "NumberLiteral" && expr2.type === "NumberLiteral") {
                    return (expr1 as NumberLiteral).value === (expr2 as NumberLiteral).value;
                }
                if (expr1.type === "Variable" && expr2.type === "Variable") {
                    return (expr1 as Variable).name === (expr2 as Variable).name;
                }
                return false;
            };

            // Pattern: (a + b) - b = a
            if (binExpr.operator === "-" && leftBin.operator === "+" && exprsEqual(leftBin.right, right)) {
                return leftBin.left;
            }
            
            // Pattern: (a - b) + b = a
            if (binExpr.operator === "+" && leftBin.operator === "-" && exprsEqual(leftBin.right, right)) {
                return leftBin.left;
            }

            // Pattern: (a + n) - m = a + (n - m) where n and m are numbers
            if (binExpr.operator === "-" && leftBin.operator === "+" && 
                leftBin.right.type === "NumberLiteral" && right.type === "NumberLiteral") {
                const n = (leftBin.right as NumberLiteral).value;
                const m = (right as NumberLiteral).value;
                const newConst = n - m;
                if (newConst === 0) {
                    return leftBin.left;
                }
                return {
                    type: "BinaryExpression",
                    operator: newConst > 0 ? "+" : "-",
                    left: leftBin.left,
                    right: { type: "NumberLiteral", value: Math.abs(newConst) } as NumberLiteral
                } as BinaryExpression;
            }

            // Pattern: (a - n) + m = a + (m - n) where n and m are numbers
            if (binExpr.operator === "+" && leftBin.operator === "-" && 
                leftBin.right.type === "NumberLiteral" && right.type === "NumberLiteral") {
                const n = (leftBin.right as NumberLiteral).value;
                const m = (right as NumberLiteral).value;
                const newConst = m - n;
                if (newConst === 0) {
                    return leftBin.left;
                }
                return {
                    type: "BinaryExpression",
                    operator: newConst > 0 ? "+" : "-",
                    left: leftBin.left,
                    right: { type: "NumberLiteral", value: Math.abs(newConst) } as NumberLiteral
                } as BinaryExpression;
            }

            // Handle like terms: (n * var ± m) - var = (n-1) * var ± m
            if (binExpr.operator === "-" && right.type === "Variable") {
                const rightVar = right as Variable;
                // Check if left side is an addition with a multiplication on the left
                if (leftBin.operator === "+") {
                    const leftLeft = leftBin.left;
                    // Pattern: ((n * var) + m) - var = ((n-1) * var) + m
                    if (leftLeft.type === "BinaryExpression") {
                        const innerBin = leftLeft as BinaryExpression;
                        if (innerBin.operator === "*" && innerBin.left.type === "NumberLiteral") {
                            const coeff = (innerBin.left as NumberLiteral).value;
                            if (innerBin.right.type === "Variable" && (innerBin.right as Variable).name === rightVar.name) {
                                const newCoeff = coeff - 1;
                                let newTerm: Expression;
                                if (newCoeff === 0) {
                                    newTerm = leftBin.right;
                                } else if (newCoeff === 1) {
                                    newTerm = {
                                        type: "BinaryExpression",
                                        operator: "+",
                                        left: innerBin.right,
                                        right: leftBin.right
                                    } as BinaryExpression;
                                } else {
                                    newTerm = {
                                        type: "BinaryExpression",
                                        operator: "+",
                                        left: {
                                            type: "BinaryExpression",
                                            operator: "*",
                                            left: { type: "NumberLiteral", value: newCoeff } as NumberLiteral,
                                            right: innerBin.right
                                        } as BinaryExpression,
                                        right: leftBin.right
                                    } as BinaryExpression;
                                }
                                return newTerm;
                            }
                        }
                    }
                }
            }

            // Handle like terms: (a * var ± m) - b * var = (a - b) * var ± m
            if (binExpr.operator === "-" && right.type === "BinaryExpression") {
                const rightBin = right as BinaryExpression;
                if (rightBin.operator === "*" && rightBin.left.type === "NumberLiteral" &&
                    leftBin.operator === "+" && leftBin.left.type === "BinaryExpression") {
                    const leftLeft = leftBin.left as BinaryExpression;
                    if (leftLeft.operator === "*" && leftLeft.left.type === "NumberLiteral") {
                        const leftVar = leftLeft.right;
                        const rightVar = rightBin.right;
                        if (leftVar.type === "Variable" && rightVar.type === "Variable" &&
                            (leftVar as Variable).name === (rightVar as Variable).name) {
                            const leftCoeff = (leftLeft.left as NumberLiteral).value;
                            const rightCoeff = (rightBin.left as NumberLiteral).value;
                            const newCoeff = leftCoeff - rightCoeff;
                            if (newCoeff === 0) {
                                return leftBin.right;
                            } else if (newCoeff === 1) {
                                return {
                                    type: "BinaryExpression",
                                    operator: "+",
                                    left: leftVar,
                                    right: leftBin.right
                                } as BinaryExpression;
                            } else {
                                return {
                                    type: "BinaryExpression",
                                    operator: "+",
                                    left: {
                                        type: "BinaryExpression",
                                        operator: "*",
                                        left: { type: "NumberLiteral", value: newCoeff } as NumberLiteral,
                                        right: leftVar
                                    } as BinaryExpression,
                                    right: leftBin.right
                                } as BinaryExpression;
                            }
                        }
                    }
                }
            }
        }

        // Handle distribution law: a * (b + c) = a*b + a*c and (b + c) * a = b*a + c*a
        if (binExpr.operator === "*") {
            // Pattern: num * (expr + expr2) = num*expr + num*expr2
            if (left.type === "NumberLiteral" && right.type === "BinaryExpression") {
                const rightBin = right as BinaryExpression;
                if (rightBin.operator === "+" || rightBin.operator === "-") {
                    const coefficient = (left as NumberLiteral).value;
                    const leftPart = {
                        type: "BinaryExpression",
                        operator: "*",
                        left: left,
                        right: rightBin.left
                    } as BinaryExpression;
                    const rightPart = {
                        type: "BinaryExpression",
                        operator: "*",
                        left: left,
                        right: rightBin.right
                    } as BinaryExpression;
                    return {
                        type: "BinaryExpression",
                        operator: rightBin.operator,
                        left: simplifyOnce(leftPart),
                        right: simplifyOnce(rightPart)
                    } as BinaryExpression;
                }
            }
            // Pattern: (expr + expr2) * num = expr*num + expr2*num
            if (right.type === "NumberLiteral" && left.type === "BinaryExpression") {
                const leftBin = left as BinaryExpression;
                if (leftBin.operator === "+" || leftBin.operator === "-") {
                    const leftPart = {
                        type: "BinaryExpression",
                        operator: "*",
                        left: leftBin.left,
                        right: right
                    } as BinaryExpression;
                    const rightPart = {
                        type: "BinaryExpression",
                        operator: "*",
                        left: leftBin.right,
                        right: right
                    } as BinaryExpression;
                    return {
                        type: "BinaryExpression",
                        operator: leftBin.operator,
                        left: simplifyOnce(leftPart),
                        right: simplifyOnce(rightPart)
                    } as BinaryExpression;
                }
            }
        }

        // Handle distribution law for division: (a + b) / c = a/c + b/c and (a - b) / c = a/c - b/c
        if (binExpr.operator === "/" && left.type === "BinaryExpression") {
            const leftBin = left as BinaryExpression;
            if (leftBin.operator === "+" || leftBin.operator === "-") {
                const leftPart = {
                    type: "BinaryExpression",
                    operator: "/",
                    left: leftBin.left,
                    right: right
                } as BinaryExpression;
                const rightPart = {
                    type: "BinaryExpression",
                    operator: "/",
                    left: leftBin.right,
                    right: right
                } as BinaryExpression;
                return {
                    type: "BinaryExpression",
                    operator: leftBin.operator,
                    left: simplifyOnce(leftPart),
                    right: simplifyOnce(rightPart)
                } as BinaryExpression;
            }
        }

        return {
            type: "BinaryExpression",
            operator: binExpr.operator,
            left,
            right
        } as BinaryExpression;
    }

    // Variable and NumberLiteral don't need simplification
    return expr;
}

export function findPermutations(expr: Equation): string[]{
    let lhs = expr.left;
    let rhs = expr.right;
    let leftPermuations = getPermutations(lhs);
    let rightPermuations = getPermutations(rhs);
    return leftPermuations.concat(rightPermuations);
}

interface SolutionTree {
    expr: Equation;
    children: SolutionTree[];
    lastPermutation?: string; // Track the permutation that led to this node
}

function getInversePermutation(perm: string): string {
    // Get the inverse of a permutation
    // +3 -> -3, -3 -> +3, *2 -> /2, /2 -> *2, etc.
    if (perm.startsWith('+')) return '-' + perm.substring(1);
    if (perm.startsWith('-')) return '+' + perm.substring(1);
    if (perm.startsWith('*')) return '/' + perm.substring(1);
    if (perm.startsWith('/')) return '*' + perm.substring(1);
    return perm;
}

function buildSolutionTree(expr: Equation, tree: SolutionTree, maxDepth: number, currentDepth: number = 0, startTime: number = 0, timeoutMs: number = 5000): void {
    // Check timeout periodically
    if (startTime && Date.now() - startTime > timeoutMs) {
        return;
    }

    if (currentDepth >= maxDepth) {
        return;
    }

    let permutations = findPermutations(expr);
    
    // Filter out the inverse of the permutation that led to this node
    if (tree.lastPermutation) {
        const inverseOfLast = getInversePermutation(tree.lastPermutation);
        permutations = permutations.filter(perm => perm !== inverseOfLast);
    }
    
    //console.log(`Depth ${currentDepth}: Applying permutations ${permutations.join(", ")}`);
    for (let perm of permutations) {
        // Check timeout while processing permutations
        if (startTime && Date.now() - startTime > timeoutMs) {
            return;
        }

        const newSol = applyPermutation(expr, perm);
        const simplifiedSol = simplify(newSol) as Equation;
        //console.log(`Depth ${currentDepth}: Applied permutation ${perm}, got ${exprToString(simplifiedSol)}`);
        const childNode: SolutionTree = {
            expr: simplifiedSol,
            children: [],
            lastPermutation: perm
        };
        tree.children.push(childNode);

        // Continue building tree if not a solution yet
        if (!isRealSolution(simplifiedSol)) {
            buildSolutionTree(simplifiedSol, childNode, maxDepth, currentDepth + 1, startTime, timeoutMs);
        }
    }
}

function extractSolutions(tree: SolutionTree): Equation[] {
    const solutions: Equation[] = [];
    
    function traverse(node: SolutionTree) {
        if (isRealSolution(node.expr)) {
            solutions.push(node.expr);
        }
        for (let child of node.children) {
            traverse(child);
        }
    }

    // Check the root node and all descendants
    traverse(tree);
    return solutions;
}

export function findSolution(expr: Equation, timeoutMs: number = 5000): { solutions: Equation[], timedOut: boolean } {
    const root: SolutionTree = {
        expr: simplify(expr) as Equation,
        children: []
    };

    // Build solution tree with increasing depth until solutions are found
    let maxDepth = 1;
    const maxIterations = 10; // Prevent infinite loops
    let solutions: Equation[] = [];
    let timedOut = false;
    const startTime = Date.now();

    for (let iteration = 0; iteration < maxIterations; iteration++) {
        // Check if timeout exceeded
        if (Date.now() - startTime > timeoutMs) {
            timedOut = true;
            console.log(`Timeout: Failed to solve in ${timeoutMs}ms (max depth reached: ${maxDepth})`);
            break;
        }

        // Clear and rebuild the tree
        root.children = [];
        buildSolutionTree(root.expr, root, maxDepth, 0, startTime, timeoutMs);
        
        // Extract all solutions from the tree
        solutions = extractSolutions(root);
        
        // If we found solutions, return them
        if (solutions.length > 0) {
            console.log(`Solutions found at depth ${maxDepth}`);
            // Store tree for visualization
            lastSolutionTree = treeToVisualizationFormat(root, false);
            return { solutions, timedOut: false };
        }

        maxDepth++;
    }

    // Return whatever we found (may be empty)
    lastSolutionTree = treeToVisualizationFormat(root, timedOut);
    return { solutions, timedOut };
}

function isRealSolution(expr: Equation): boolean{
    let lhs = expr.left;
    let rhs = expr.right;
    if(lhs.type == "Variable"){
        return onlyNumbers(rhs);
    }
    if(rhs.type == "Variable"){
        return onlyNumbers(lhs);
    }
    return false;
}

function onlyNumbers(expr: Expression): boolean{
    if(expr.type == "NumberLiteral"){
        return true;
    }
    if(expr.type == "BinaryExpression"){
        let binExpr = expr as BinaryExpression;
        return onlyNumbers(binExpr.left) && onlyNumbers(binExpr.right);
    }
    return false;
}


export function applyPermutation(expr: Equation, permutation: string): Equation{
    let newExpr = {
        type: "Equation",
        left: expr.left,
        right: expr.right
    } as Equation;
    // Add space before permutation to avoid parsing issues (e.g., ")- 3" instead of ")-3")
    newExpr.left = parse(tokenize("(" + exprToString(expr.left) + ") " + permutation));
    newExpr.right = parse(tokenize("(" + exprToString(expr.right) + ") " + permutation));
    //console.log(`Applied permutation ${permutation}: ${exprToString(newExpr)}`);
    return  newExpr;
}  
        

function getPermutations(expr: Expression): string[]{
    let permutations:string[] = [];
    if(expr.type == "NumberLiteral" || expr.type == "Variable"){
        return ["-" + exprToString(expr)]; 
    }
    if(expr.type === "BinaryExpression"){
        let binExpr = expr as BinaryExpression;
        let right = binExpr.right;
        let left = binExpr.left
        switch(binExpr.operator){
            case "+":
                permutations.push("-" + exprToString(right));
                permutations.push("-" + exprToString(left));
                break
            case "-":
                permutations.push("+" + exprToString(right));
                permutations.push("+" + exprToString(left));
    
                break;
            case "*":
                permutations.push("/" + exprToString(right));
                permutations.push("/" + exprToString(left));
                break;
            case "/":
                permutations.push("*" + exprToString(right));
                permutations.push("*" + exprToString(left));
                break;
        }
    }
    return permutations;
}
