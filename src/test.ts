import { findSolution } from "./solver.js";
import { parse, Equation } from "./parser.js";
import { tokenize } from "./tokenizer.js";

interface TestCase {
    equation: string;
    expectedSolutions: number[];
    description: string;
}

const testCases: TestCase[] = [
    {
        equation: "x + 2 = 5",
        expectedSolutions: [3],
        description: "Simple addition"
    },
    {
        equation: "x - 3 = 7",
        expectedSolutions: [10],
        description: "Simple subtraction"
    },
    {
        equation: "2 * x = 8",
        expectedSolutions: [4],
        description: "Simple multiplication"
    },
    {
        equation: "x / 2 = 5",
        expectedSolutions: [10],
        description: "Simple division"
    },
    {
        equation: "2 * x + 3 = 7",
        expectedSolutions: [2],
        description: "Multi-step linear"
    },
    {
        equation: "2 * x + 3 = 7 + x",
        expectedSolutions: [4],
        description: "Both sides with variables"
    },
    {
        equation: "x + x = 10",
        expectedSolutions: [5],
        description: "Variable on both sides (like terms)"
    },
    {
        equation: "3 * x - 5 = 10",
        expectedSolutions: [5],
        description: "Multi-step with subtraction"
    },
    {
        equation: "x + 1 + 2 = 8",
        expectedSolutions: [5],
        description: "Multiple constants"
    },
    {
        equation: "2 * x + 2 * x = 16",
        expectedSolutions: [4],
        description: "Multiple like terms"
    }
];

function evaluateExpression(expr: string, xValue: number): number {
    // Simple evaluation: replace x with value and eval
    const evalStr = expr.replace(/x/g, `(${xValue})`);
    try {
        return eval(evalStr);
    } catch {
        return NaN;
    }
}

function testEquation(testCase: TestCase): boolean {
    try {
        const parsed = parse(tokenize(testCase.equation)) as Equation;
        const result = findSolution(parsed, 5000); // 5 second timeout
        const solutions = result.solutions;
        
        if (result.timedOut) {
            console.log(`⏱️  ${testCase.description}: Timeout (took longer than 5 seconds)`);
            return false;
        }
        
        if (solutions.length === 0) {
            console.log(`❌ ${testCase.description}: No solutions found`);
            return false;
        }

        // Extract the value of x from each solution
        const solutionValues: number[] = [];
        for (let solution of solutions) {
            // Try to extract x value from "x = value" format
            const exprStr = solution.left.type === "Variable" && 
                          (solution.left as any).name === "x"
                ? solution.right
                : solution.left;
            
            // If it's a simple number literal, use it
            if (exprStr.type === "NumberLiteral") {
                solutionValues.push((exprStr as any).value);
            }
        }

        // Check if any solution matches the expected values
        const matches = testCase.expectedSolutions.some(expected => 
            solutionValues.some(actual => Math.abs(actual - expected) < 0.0001)
        );

        if (matches) {
            console.log(`✅ ${testCase.description}: Found x = ${solutionValues.join(", ")}`);
            return true;
        } else {
            console.log(`❌ ${testCase.description}: Expected x = ${testCase.expectedSolutions.join(", ")}, got x = ${solutionValues.join(", ")}`);
            return false;
        }
    } catch (err) {
        console.log(`❌ ${testCase.description}: Error - ${(err as Error).message}`);
        return false;
    }
}

export function runTests(): void {
    console.log("\n🧪 Running Equation Solver Tests...\n");
    
    let passed = 0;
    let failed = 0;

    for (let testCase of testCases) {
        if (testEquation(testCase)) {
            passed++;
        } else {
            failed++;
        }
    }

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests\n`);
    
    if (failed === 0) {
        console.log("🎉 All tests passed!");
    }
}

// Run tests
runTests();
