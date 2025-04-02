const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

class TACGenerator {
    constructor() {
        this.tempCount = 1;
        this.address = 100;
    }

    generateTAC(code) {
        this.tempCount = 1;
        this.address = 100;

        const lines = code.split("\n").map(line => line.trim()).filter(line => line);
        let tacLines = [];
        let stack = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.startsWith("for")) {
                const iterator = line.match(/\((.*?)\)/)?.[1];
                if (!iterator) continue;
                
                const [init, condition, increment] = iterator.split(";").map(s => s.trim());
                
                // Handle initialization
                if (init) {
                    tacLines.push(`${this.address++}: ${init}`);
                }
                
                const loopStart = this.address;
                const temp = `t${this.tempCount++}`;
                tacLines.push(`${this.address++}: ${temp} = ${condition}`);
                const exitJump = this.address++;
                tacLines.push(`${exitJump}: ifFalse ${temp} goto ?`); // Will be updated later
                
                stack.push({
                    type: 'for',
                    exitJump,
                    loopStart,
                    increment,
                    temp
                });
            } 
            
            else if (line.startsWith("if")) {
                const condition = line.match(/\((.*?)\)/)?.[1];
                if (!condition) continue;
                
                const temp = `t${this.tempCount++}`;
                tacLines.push(`${this.address++}: ${temp} = ${condition}`);
                const ifFalseAddr = this.address++;
                tacLines.push(`${ifFalseAddr}: ifFalse ${temp} goto ?`); 
                
                stack.push({
                    type: 'if',
                    ifFalseAddr,
                    temp,
                    hasElse: false
                });
            } 
            
            else if (line.startsWith("else")) {
                const prev = stack[stack.length - 1];
                if (prev && prev.type === 'if') {
                    // Update the ifFalse to point to next instruction
                    tacLines[prev.ifFalseAddr] = `${prev.ifFalseAddr}: ifFalse ${prev.temp} goto ${this.address}`;
                    
                    prev.hasElse = true;
                    stack.push({
                        type: 'else',
                        ifStmt: prev
                    });
                }
            } 
            
            else if (line === "}") {
                const prev = stack.pop();
                if (!prev) continue;

                switch (prev.type) {
                    case 'for':
                        
                        if (prev.increment) {
                            if (prev.increment.includes("++")) {
                               
                                const varName = prev.increment.replace("++", "").trim();
                                const temp = `t${this.tempCount++}`;
                                tacLines.push(`${this.address++}: ${varName}++ = ${temp}`);
                            } else {
                               
                                const [varName, expr] = prev.increment.split("=").map(x => x.trim());
                                const temp = `t${this.tempCount++}`;
                                tacLines.push(`${this.address++}: ${temp} = ${expr}`);
                                tacLines.push(`${this.address++}: ${varName} = ${temp}`);
                            }
                        }
                        
                        tacLines.push(`${this.address++}: goto ${prev.loopStart}`);
                        
                        tacLines[prev.exitJump] = `${prev.exitJump}: ifFalse ${prev.temp} goto ${this.address}`;
                        break;
                        
                    case 'if':
                        
                        if (!prev.hasElse) {
                            tacLines[prev.ifFalseAddr] = `${prev.ifFalseAddr}: ifFalse ${prev.temp} goto ${this.address}`;
                        }
                        break;
                        
                    case 'else':
                        
                        break;
                }
            } 
            
            else if (line.includes("=")) {
                const [varName, expr] = line.split("=").map(x => x.trim());
                if (!expr) return;

                // Handle complex expressions
                const parts = expr.split(/([+\-*/])/).map(p => p.trim()).filter(p => p);
                if (parts.length > 1) {
                    // Handle binary operations
                    let result = parts[0];
                    for (let j = 1; j < parts.length; j += 2) {
                        const op = parts[j];
                        const right = parts[j + 1];
                        const temp = `t${this.tempCount++}`;
                        tacLines.push(`${this.address++}: ${temp} = ${result} ${op} ${right}`);
                        result = temp;
                    }
                    tacLines.push(`${this.address++}: ${varName} = ${result}`);
                } else {
                    // Handle simple assignment
                    const temp = `t${this.tempCount++}`;
                    tacLines.push(`${this.address++}: ${temp} = ${expr}`);
                    tacLines.push(`${this.address++}: ${varName} = ${temp}`);
                }
            }
        }

        // Add end label
        tacLines.push(`${this.address}: (End)`);

        // Process the TAC lines to resolve addresses and remove placeholders
        const processedLines = [];
        const seenAddresses = new Set();
        
        for (const line of tacLines) {
            if (!line || line.includes('undefined') || line.includes('goto ?')) continue;
            
            // Skip duplicate addresses
            const address = parseInt(line.split(':')[0]);
            if (seenAddresses.has(address)) continue;
            seenAddresses.add(address);
            
            processedLines.push(line);
        }

        // Sort by address and join
        return processedLines
            .sort((a, b) => {
                const addrA = parseInt(a.split(':')[0]);
                const addrB = parseInt(b.split(':')[0]);
                return addrA - addrB;
            })
            .join('\n');
    }
}

function validateCode(code) {
    if (!code || typeof code !== 'string') {
        return { isValid: false, error: 'Invalid code format' };
    }

    // Check for balanced braces
    let braceCount = 0;
    for (const char of code) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        if (braceCount < 0) {
            return { isValid: false, error: 'Unmatched closing brace' };
        }
    }
    if (braceCount !== 0) {
        return { isValid: false, error: 'Unmatched opening brace' };
    }

    // Basic syntax validation
    const requiredKeywords = ['for', 'if', 'else'];
    const hasKeywords = requiredKeywords.some(keyword => code.includes(keyword));
    if (!hasKeywords) {
        return { isValid: false, error: 'Code must contain at least one control structure (for, if, else)' };
    }

    return { isValid: true };
}

// API endpoint for TAC generation
app.post('/api/generate-tac', (req, res) => {
    try {
        const { code } = req.body;
        console.log('Received code:', code); // Debug log

        // Validate input
        const validation = validateCode(code);
        if (!validation.isValid) {
            console.log('Validation failed:', validation.error); // Debug log
            return res.status(400).json({ error: validation.error });
        }

        // Generate TAC
        const tacGenerator = new TACGenerator();
        const tac = tacGenerator.generateTAC(code);
        console.log('Generated TAC:', tac); // Debug log

        res.json({ tac });
    } catch (error) {
        console.error('Error generating TAC:', error);
        res.status(500).json({ error: 'Failed to generate TAC: ' + error.message });
    }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 