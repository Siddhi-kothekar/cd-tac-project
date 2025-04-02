import React, { useState } from 'react';
import TACGenerator from './TACGenerator';
import './TACGenerator.css';

function TACGeneratorComponent() {
    const [code, setCode] = useState('');
    const [tac, setTac] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const tacGenerator = new TACGenerator();

    const generateTAC = async () => {
        try {
            setLoading(true);
            setError('');
            
            const response = await fetch('/api/generate-tac', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code }),
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate TAC');
            }

            setTac(data.tac);
        } catch (err) {
            setError(err.message);
            setTac('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="tac-generator">
            <div className="input-section">
                <h2>Input Code</h2>
                <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter your C code here..."
                    rows={20}
                />
                <button onClick={generateTAC} disabled={loading}>
                    {loading ? 'Generating...' : 'Generate TAC'}
                </button>
            </div>
            <div className="output-section">
                <h2>Three Address Code</h2>
                {error ? (
                    <div className="error">{error}</div>
                ) : (
                    <pre>{tac || 'Generated TAC will appear here...'}</pre>
                )}
            </div>
        </div>
    );
}

export default TACGeneratorComponent;
