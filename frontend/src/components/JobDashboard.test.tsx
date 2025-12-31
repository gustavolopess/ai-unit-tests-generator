import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { JobDashboard } from './JobDashboard';
import axios from 'axios';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock axios
vi.mock('axios');

describe('JobDashboard', () => {
    const mockOnBack = vi.fn();
    const mockOnSwitchJob = vi.fn();
    const jobId = 'job-123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders loading state initially', async () => {
        // Return a promise that never resolves to simulate loading
        (axios.get as any).mockReturnValue(new Promise(() => { }));

        render(<JobDashboard jobId={jobId} onBack={mockOnBack} onSwitchJob={mockOnSwitchJob} />);

        expect(screen.getByText('Loading job data...')).toBeInTheDocument();
    });

    it('displays job details when data is loaded', async () => {
        const mockJob = {
            jobId: 'job-123',
            status: 'completed',
            repositoryUrl: 'http://github.com/test/repo',
            averageCoverage: 85.5,
            totalFiles: 10,
            output: ['Log line 1'],
            files: [
                { file: 'src/test.ts', coverage: 90, needsImprovement: false }
            ]
        };

        (axios.get as any).mockResolvedValue({ data: mockJob });

        render(<JobDashboard jobId={jobId} onBack={mockOnBack} onSwitchJob={mockOnSwitchJob} />);

        // Fast-forward timers to trigger useEffect async call
        // Note: axios.get is async, passing time won't resolve it, but wrapping in waitFor handles the promise resolution

        await waitFor(() => {
            expect(screen.getByText('COMPLETED')).toBeInTheDocument();
        });

        expect(screen.getByText('http://github.com/test/repo')).toBeInTheDocument();
        expect(screen.getByText('85.50%')).toBeInTheDocument();
        expect(screen.getByText('src/test.ts')).toBeInTheDocument();
    });

    it('handles test generation trigger', async () => {
        const mockJob = {
            jobId: 'job-123',
            status: 'completed',
            repositoryUrl: 'http://github.com/test/repo',
            averageCoverage: 40,
            totalFiles: 1,
            output: [],
            files: [
                { file: 'src/bad.ts', coverage: 40, needsImprovement: true }
            ]
        };

        (axios.get as any).mockResolvedValue({ data: mockJob });
        (axios.post as any).mockResolvedValue({ data: { jobId: 'job-456' } });

        render(<JobDashboard jobId={jobId} onBack={mockOnBack} onSwitchJob={mockOnSwitchJob} />);

        await waitFor(() => screen.getByText('src/bad.ts'));

        const button = screen.getByRole('button', { name: /generate tests/i });
        fireEvent.click(button);

        expect(screen.getByText('Generating...')).toBeInTheDocument();

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith('http://localhost:3000/jobs', {
                jobId: 'job-123',
                targetFilePath: 'src/bad.ts',
                entrypoint: undefined
            });
            expect(mockOnSwitchJob).toHaveBeenCalledWith('job-456');
        });
    });

    it('shows error state', async () => {
        const mockJob = {
            jobId: 'job-123',
            status: 'failed',
            repositoryUrl: 'http://github.com/test/repo',
            output: [],
            error: 'Something went wrong'
        };

        (axios.get as any).mockResolvedValue({ data: mockJob });

        render(<JobDashboard jobId={jobId} onBack={mockOnBack} onSwitchJob={mockOnSwitchJob} />);

        await waitFor(() => {
            expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        });
    });
});
