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
            return (expr as NumberLiteral).value.toString();
        case "Variable":
            return (expr as Variable).name;
        case "BinaryExpression":
            let binExpr = expr as BinaryExpression;
            return `${exprToString(binExpr.left)} ${binExpr.operator} ${exprToString(binExpr.right)}`;
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
        let left = parsePrimary();

        while (peek() && (peek()!.type === TokenType.Multiply || peek()!.type === TokenType.Divide)) {
            const operator = consume();
            const right = parsePrimary();
            left = {
                type: "BinaryExpression",
                operator: operator.value,
                left,
                right
            } as BinaryExpression;
        }

        return left;
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


