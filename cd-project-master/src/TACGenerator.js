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
                const [init, condition, increment] = iterator.split(";").map(s => s.trim());
                
                // Handle initialization
                if (init) {
                    tacLines.push(`${this.address++}: ${init}`);
                }
                
                const loopStart = this.address;
                const temp = `t${this.tempCount++}`;
                tacLines.push(`${this.address++}: ${temp} = ${condition}`);
                const exitJump = this.address++;
                tacLines.push(`${exitJump}: ifFalse ${temp} goto ?`);
                
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
                const temp = `t${this.tempCount++}`;
                tacLines.push(`${this.address++}: ${temp} = ${condition}`);
                const elseJump = this.address++;
                tacLines.push(`${elseJump}: ifFalse ${temp} goto ?`);
                
                stack.push({
                    type: 'if',
                    elseJump,
                    temp
                });
            } 
            
            else if (line.startsWith("else")) {
                const prev = stack.pop();
                if (prev && prev.type === 'if') {
                    const endIfJump = this.address++;
                    tacLines.push(`${endIfJump}: goto ?`);
                    tacLines[prev.elseJump] = `${prev.elseJump}: ifFalse ${prev.temp} goto ${this.address}`;
                    stack.push({
                        type: 'else',
                        endIfJump
                    });
                }
            } 
            
            else if (line === "}") {
                const prev = stack.pop();
                if (!prev) continue;

                if (prev.type === 'for') {
                    // Handle loop end
                    if (prev.increment) {
                        tacLines.push(`${this.address++}: ${prev.increment}`);
                    }
                    tacLines.push(`${this.address++}: goto ${prev.loopStart}`);
                    tacLines[prev.exitJump] = `${prev.exitJump}: ifFalse ${prev.temp} goto ${this.address}`;
                }
                else if (prev.type === 'else') {
                    // Handle else end
                    tacLines[prev.endIfJump] = `${prev.endIfJump}: goto ${this.address}`;
                }
            } 
            
            else if (line.includes("=")) {
                const [varName, expr] = line.split("=").map(x => x.trim());
                if (expr) {
                    const temp = `t${this.tempCount++}`;
                    tacLines.push(`${this.address++}: ${temp} = ${expr}`);
                    tacLines.push(`${this.address++}: ${varName} = ${temp}`);
                }
            }
        }

        return tacLines.join("\n");
    }
}

module.exports = TACGenerator; 