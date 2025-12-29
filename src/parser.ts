import {Token,TokenType,findClosingParen} from "./tokenizer.js";

export interface Expression {
    type: string;
}

export interface BinaryExpression extends Expression {
    type: "BinaryExpression";
    operator: string;
    left: Expression;
    right: Expression;
}

export interface NumberLiteral extends Expression {
    type: "NumberLiteral";
    value: number;
}

export interface Variable extends Expression {
    type: "Variable";
    name: string;
}

export interface Equation extends Expression {
    type: "Equation";
    left: Expression;
    right: Expression;
}

export function exprToString(expr: Expression): string {
    switch(expr.type){
        case "NumberLiteral":
            const val = (expr as NumberLiteral).value;
            // Wrap negative numbers in parentheses for safe parsing
            return val < 0 ? `(${val})` : val.toString();
        case "Variable":
            return (expr as Variable).name;
        case "BinaryExpression":
            let binExpr = expr as BinaryExpression;
            let leftStr = exprToString(binExpr.left);
            let rightStr = exprToString(binExpr.right);
            
            // Add parentheses to left operand if it's a lower-precedence operation
            if (binExpr.left.type === "BinaryExpression") {
                const leftBin = binExpr.left as BinaryExpression;
                // Addition/subtraction have lower precedence than multiplication/division
                if ((leftBin.operator === "+" || leftBin.operator === "-") && 
                    (binExpr.operator === "*" || binExpr.operator === "/")) {
                    leftStr = `(${leftStr})`;
                }
            }
            
            // Add parentheses to right operand if it's a lower-precedence operation
            // or if it would cause ambiguity with associativity
            if (binExpr.right.type === "BinaryExpression") {
                const rightBin = binExpr.right as BinaryExpression;
                // Addition/subtraction have lower precedence than multiplication/division
                if ((rightBin.operator === "+" || rightBin.operator === "-") && 
                    (binExpr.operator === "*" || binExpr.operator === "/")) {
                    rightStr = `(${rightStr})`;
                }
                // Right associativity issues: x - (y - z) is different from x - y - z
                if (binExpr.operator === "-" && rightBin.operator === "-") {
                    rightStr = `(${rightStr})`;
                }
                if (binExpr.operator === "-" && rightBin.operator === "+") {
                    rightStr = `(${rightStr})`;
                }
                // Right associativity issues for division: x / (y / z) is different from x / y / z
                if (binExpr.operator === "/" && (rightBin.operator === "/" || rightBin.operator === "*")) {
                    rightStr = `(${rightStr})`;
                }
            }
            
            return `${leftStr} ${binExpr.operator} ${rightStr}`;
        case "Equation":
            let eqExpr = expr as Equation;
            return `${exprToString(eqExpr.left)} = ${exprToString(eqExpr.right)}`;
    }
    return "";
}

export function parse(tokens: Token[]): Expression {
    let position = 0;

    function peek(): Token | undefined {
        return tokens[position];
    }

    function consume(): Token {
        return tokens[position++];
    }

    function parseExpression(): Expression {
        return parseEquation();
    }

    function parseEquation(): Expression {
        let left = parseAddSubtract();

        if (peek() && peek()!.type === TokenType.Equals) {
            consume(); // consume '='
            const right = parseAddSubtract();
            return {
                type: "Equation",
                left,
                right
            } as Equation;
        }

        return left;
    }

    function parseAddSubtract(): Expression {
        let left = parseMultiplyDivide();

        while (peek() && (peek()!.type === TokenType.Plus || peek()!.type === TokenType.Minus)) {
            const operator = consume();
            const right = parseMultiplyDivide();
            left = {
                type: "BinaryExpression",
                operator: operator.value,
                left,
                right
            } as BinaryExpression;
        }

        return left;
    }

    function parseMultiplyDivide(): Expression {
        let left = parseUnary();

        while (peek() && (peek()!.type === TokenType.Multiply || peek()!.type === TokenType.Divide)) {
            const operator = consume();
            const right = parseUnary();
            left = {
                type: "BinaryExpression",
                operator: operator.value,
                left,
                right
            } as BinaryExpression;
        }

        return left;
    }

    function parseUnary(): Expression {
        const token = peek();
        
        // Handle unary minus and plus
        if (token && (token.type === TokenType.Minus || token.type === TokenType.Plus)) {
            const operator = consume();
            const operand = parseUnary(); // Allow chaining of unary operators
            
            if (operator.type === TokenType.Minus) {
                // Unary minus: -x becomes (0 - x)
                return {
                    type: "BinaryExpression",
                    operator: "-",
                    left: { type: "NumberLiteral", value: 0 } as NumberLiteral,
                    right: operand
                } as BinaryExpression;
            }
            // Unary plus just returns the operand
            return operand;
        }
        
        return parsePrimary();
    }

    function parsePrimary(): Expression {
        const token = peek();
        
        if (!token) {
            throw new Error("Unexpected end of input");
        }

        if (token.type === TokenType.Number) {
            consume();
            return {
                type: "NumberLiteral",
                value: parseFloat(token.value)
            } as NumberLiteral;
        }

        if (token.type === TokenType.Variable) {
            consume();
            return {
                type: "Variable",
                name: token.value
            } as Variable;
        }

        if (token.type === TokenType.Oparen) {
            consume(); // consume '('
            const expr = parseExpression();
            if (!peek() || peek()!.type !== TokenType.Cparen) {
                throw new Error("Expected closing parenthesis");
            }
            consume(); // consume ')'
            return expr;
        }

        throw new Error(`Unexpected token: ${token.value}`);
    }

    const result = parseExpression();
    
    if (position < tokens.length) {
        throw new Error(`Unexpected token after expression: ${tokens[position].value}`);
    }

    return result;
}


