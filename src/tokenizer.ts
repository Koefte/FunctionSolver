export enum TokenType {
    Number,
    Plus,
    Minus,
    Multiply,
    Divide,
    Oparen,
    Cparen,
    Variable,
    Equals
}

export interface Token {
    type: TokenType;
    value: string;
}

export function findClosingParen(tokens: Token[], openIndex: number): number {
    let depth = 1;
    for (let i = openIndex + 1; i < tokens.length; i++) {
        if (tokens[i].type === TokenType.Oparen) {
            depth++;
        } else if (tokens[i].type === TokenType.Cparen) {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    throw new Error("No matching closing parenthesis found.");
}

export function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < input.length) {
        const char = input[i];
        if (/\s/.test(char)) {
            i++;
            continue;
        } else if (/\d/.test(char)) {
            let num = char;
            // Parse integer part
            while (i + 1 < input.length && /\d/.test(input[i + 1])) {
                num += input[++i];
            }
            // Parse decimal part if present
            if (i + 1 < input.length && input[i + 1] === '.' && i + 2 < input.length && /\d/.test(input[i + 2])) {
                num += input[++i]; // add the '.'
                while (i + 1 < input.length && /\d/.test(input[i + 1])) {
                    num += input[++i];
                }
            }
            tokens.push({ type: TokenType.Number, value: num });
        } else if (char === '+') {
            tokens.push({ type: TokenType.Plus, value: char });
        } else if (char === '-') {
            tokens.push({ type: TokenType.Minus, value: char });
        } else if (char === '*') {
            tokens.push({ type: TokenType.Multiply, value: char });
        } else if (char === '/') {
            tokens.push({ type: TokenType.Divide, value: char });
        } else if (char === '(') {
            tokens.push({ type: TokenType.Oparen, value: char });
        } else if (char === ')') {
            tokens.push({ type: TokenType.Cparen, value: char });
        } else if (char === '=') {
            tokens.push({ type: TokenType.Equals, value: char });
        } else if (/[a-zA-Z]/.test(char)) {
            tokens.push({ type: TokenType.Variable, value: char });
        } else {
            throw new Error(`Unexpected character: ${char}`);
        }
        i++;
    }
    return tokens;
}