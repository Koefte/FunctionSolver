import { Equation, exprToString, parse } from "./parser.js";
import { tokenize } from "./tokenizer.js";
import { findSolution } from "./solver.js";

const expr = "x+2-2+2-2+2-2+2-2+2-2+2=0";

const tokens = tokenize(expr)
const parsedExpr:Equation = parse(tokens) as Equation;
console.log("Parsed expression: " + exprToString(parsedExpr));

const result = findSolution(parsedExpr);
console.log("Solutions:");
for(let sol of result.solutions) {
    console.log(exprToString(sol));
}
if (result.timedOut) {
    console.log("(Search timed out)");
}