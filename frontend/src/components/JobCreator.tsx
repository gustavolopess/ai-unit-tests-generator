import React, { useState } from 'react';
import axios from 'axios';

interface JobCreatorProps {
    onJobCreated: (jobId: string) => void;
}

export const JobCreator: React.FC<JobCreatorProps> = ({ onJobCreated }) => {
    const [url, setUrl] = useState('');
    const [entrypoint, setEntrypoint] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await axios.post('http://localhost:3000/jobs', {
                repositoryUrl: url,
                entrypoint: entrypoint || undefined,
            });
            onJobCreated(response.data.jobId);
        } catch (err) {
            setError('Failed to create job. Please check the URL and try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card">
            <h2>Analyze Repository</h2>
            <form onSubmit={handleSubmit}>
                <div className="input-group" style={{ flexDirection: 'column' }}>
                    <div className="input-row">
                        <input
                            type="url"
                            placeholder="https://github.com/username/repo"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            required
                            disabled={loading}
                            className="job-url-input"
                        />
                        <input
                            type="text"
                            placeholder="Entrypoint (e.g. packages/backend)"
                            value={entrypoint}
                            onChange={(e) => setEntrypoint(e.target.value)}
                            disabled={loading}
                            className="entrypoint-input"
                        />
                        <button type="submit" disabled={loading}>
                            {loading ? 'Starting...' : 'Analyze'}
                        </button>
                    </div>
                </div>
                {error && <p style={{ color: '#dc2626' }}>{error}</p>}
            </form>
        </div>
    );
};
