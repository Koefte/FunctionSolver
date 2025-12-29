import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { tokenize } from './dist/tokenizer.js';
import { parse, exprToString } from './dist/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

app.post('/solve', async (req, res) => {
    try {
        const { equation, timeoutMs = 5000 } = req.body;
        if (!equation) {
            return res.status(400).json({ error: 'Equation required' });
        }

        // Dynamic import to get the solver functions
        const { findSolution, getSolutionTree } = await import('./dist/solver.js');

        const tokens = tokenize(equation);
        const parsedExpr = parse(tokens);
        
        const result = findSolution(parsedExpr, timeoutMs);
        const tree = getSolutionTree();

        res.json({
            solutions: result.solutions.map(sol => exprToString(sol)),
            tree: tree,
            depth: tree.depth || 0,
            timedOut: result.timedOut
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Open visualize.html in your browser to use the visualizer`);
});
