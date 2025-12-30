import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

interface FileCoverage {
    file: string;
    coverage: number;
    needsImprovement: boolean;
}

interface JobResult {
    jobId: string;
    parentJobId?: string;
    status: 'pending' | 'cloning' | 'installing' | 'analyzing' | 'analysis_completed' | 'generating_tests' | 'test_generation_completed' | 'creating_pr' | 'pr_creation_completed' | 'completed' | 'failed';
    repositoryUrl: string;
    targetFilePath?: string;
    entrypoint?: string;
    totalFiles?: number;
    averageCoverage?: number;
    files?: FileCoverage[];
    output: string[];
    testGenerationResult?: {
        filePath: string;
        testFilePath?: string;
        coverage?: number;
    };
    prCreationResult?: {
        prUrl: string;
        prNumber: number;
    };
    error?: string;
}

interface JobDashboardProps {
    jobId: string;
    onBack: () => void;
    onSwitchJob: (jobId: string) => void;
}

const isJobInFinalStatus = (job: JobResult | null) => {
    return job?.status.toLowerCase() === 'completed' || job?.status.toLowerCase() === 'failed';
}

const isJobSuccess = (job: JobResult | null) => {
    return job?.status.toLowerCase() === 'completed';
}

export const JobDashboard: React.FC<JobDashboardProps> = ({ jobId, onBack, onSwitchJob }) => {
    const [job, setJob] = useState<JobResult | null>(null);
    const [generatingFile, setGeneratingFile] = useState<string | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

    console.log(job?.status, isJobInFinalStatus(job))

    const pollJob = async () => {
        try {
            const response = await axios.get(`http://localhost:3000/jobs/${jobId}`);
            setJob(response.data);
            if (!isJobInFinalStatus(response.data)) {
                setGeneratingFile(response.data.targetFilePath);
            } else {
                setGeneratingFile(null);
            }
        } catch (err) {
            console.error('Error fetching job:', err);
        }
    };

    console.log('GENERATING FILE', generatingFile);

    const handleGenerateTests = async (file: string) => {
        if (!job) return;
        console.log('GENERATING FILE 3', file);
        setGeneratingFile(file);
        try {
            // If this is a child job (test generation), we want to use the PARENT job ID
            // to base the new test generation on the original analysis.
            // If it's a parent job (analysis), we use its ID.
            const baseJobId = job.parentJobId || job.jobId;

            const response = await axios.post('http://localhost:3000/jobs', {
                jobId: baseJobId,
                targetFilePath: file,
                entrypoint: job.entrypoint,
            });
            onSwitchJob(response.data.jobId);
        } catch (err) {
            console.error('Error starting test generation:', err);
            alert('Failed to start test generation');
            setGeneratingFile(null);
        }
    };

    useEffect(() => {
        pollJob();
        const interval = setInterval(pollJob, 2000);
        return () => {
            clearInterval(interval);
            // Reset generating file state when component unmounts or jobId changes
            console.log('RESET GENERATING FILE');
            setGeneratingFile(null);
        };
    }, [jobId]);

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [job?.output.length]);

    if (!job) return <div className="card">Loading job data...</div>;

    return (
        <div className="dashboard-container">
            <div className="card">
                <div className="job-header">
                    <button onClick={onBack} className="back-button">
                        ← Back
                    </button>
                    <h2>Job Analysis</h2>
                    <span className={`badge ${job.status} ${!isJobInFinalStatus(job) ? 'shimmer-text' : ''} ${isJobSuccess(job) ? 'success' : 'failure'}`}>
                        {job.status.toUpperCase()}
                    </span>
                </div>

                <p className="repo-info"><strong>Repository:</strong> {job.repositoryUrl}</p>

                {job.error && (
                    <div style={{ color: '#dc2626', marginTop: '1rem', padding: '1rem', border: '1px solid #dc2626', borderRadius: '8px' }}>
                        <strong>Error:</strong> {job.error}
                    </div>
                )}

                <div style={{ marginTop: '1rem' }}>
                    <h3>Logs</h3>
                    <div className="logs-container">
                        {job.output.map((line, i) => (
                            <div key={i}>{line}</div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>

            {(job.status === 'completed' || job.files) && (
                <div className="card">
                    <h3>Coverage Results</h3>
                    <div className="stats-container">
                        <div>
                            <strong>Average Coverage:</strong>{' '}
                            <span style={{
                                color: (job.averageCoverage || 0) >= 80 ? '#059669' :
                                    (job.averageCoverage || 0) >= 50 ? '#d97706' : '#dc2626',
                                fontWeight: 'bold',
                                fontSize: '1.2em'
                            }}>
                                {job.averageCoverage?.toFixed(2)}%
                            </span>
                        </div>
                        <div>
                            <strong>Total Files:</strong> {job.totalFiles}
                        </div>
                    </div>

                    {job.prCreationResult && (
                        <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(5, 150, 105, 0.1)', border: '1px solid #059669', borderRadius: '8px' }}>
                            <strong>✅ Pull Request Created!</strong>
                            <br />
                            <a href={job.prCreationResult.prUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#059669', fontWeight: 'bold' }}>
                                View Pull Request →
                            </a>
                        </div>
                    )}

                    <div className="file-list">
                        {job.files?.map((file) => (
                            <div key={file.file} className="file-item">
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{file.file}</span>
                                        <span>{file.coverage.toFixed(2)}%</span>
                                    </div>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{
                                                width: `${file.coverage}%`,
                                                backgroundColor: !file.needsImprovement ? '#059669' :
                                                    file.coverage >= 50 ? '#d97706' : '#dc2626'
                                            }}
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleGenerateTests(file.file)}
                                    disabled={generatingFile !== null}
                                    className={generatingFile === file.file ? 'shimmer-active' : ''}
                                    style={{
                                        marginLeft: '1rem',
                                        padding: '0.4em 0.8em',
                                        fontSize: '0.8em',
                                        opacity: generatingFile !== null ? (generatingFile === file.file ? 1 : 0.6) : 1,
                                        cursor: generatingFile !== null ? 'not-allowed' : 'pointer',
                                        border: 'none'
                                    }}
                                    title="Generate tests for this file"
                                >
                                    {generatingFile === file.file ? 'Generating...' : '⚡ Generate Tests'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
