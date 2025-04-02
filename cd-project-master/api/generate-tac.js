const TACGenerator = require('../src/TACGenerator');

function validateCode(code) {
    if (!code || typeof code !== 'string') {
        return { valid: false, error: 'Invalid code format' };
    }

    // Check for balanced braces
    let braceCount = 0;
    for (const char of code) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        if (braceCount < 0) {
            return { valid: false, error: 'Unmatched closing brace' };
        }
    }
    if (braceCount !== 0) {
        return { valid: false, error: 'Unmatched opening brace' };
    }

    // Check for basic syntax
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('for') && !line.includes('(')) {
            return { valid: false, error: `Invalid for loop syntax at line ${i + 1}` };
        }
        if (line.startsWith('if') && !line.includes('(')) {
            return { valid: false, error: `Invalid if statement syntax at line ${i + 1}` };
        }
    }

    return { valid: true };
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: 'No code provided' });
    }

    // Validate code
    const validation = validateCode(code);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    try {
        const generator = new TACGenerator();
        const tac = generator.generateTAC(code);
        return res.status(200).json({ tac });
    } catch (error) {
        console.error('Error generating TAC:', error);
        return res.status(500).json({ 
            error: 'Failed to generate TAC',
            details: error.message 
        });
    }
} 