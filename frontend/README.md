# AI Unit Tests Generator - Frontend

A React application for monitoring test coverage analysis and triggering AI-powered test generation, built with Vite.

## Features

- **Jobs Dashboard**: View the status of coverage analysis jobs (Pending, Analyzing, Completed, Failed).
- **Coverage Visualization**: See coverage percentages per file with visual progress bars.
- **Interactive Actions**: Trigger test generation for specific files directly from the UI.
- **Real-time Logs**: View live logs from the backend processing.
- **Pull Request Links**: Direct links to created GitHub Pull Requests with generated tests.

## Prerequisites

- Node.js (v18 or higher)
- npm
- The **Backend Service** must be running locally on port `3000`.

## Installation

1. Navigate to the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

## Running the Application

1. Start the development server:

   ```bash
   npm run dev
   ```

2. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`).

### Connecting to Backend

The frontend application expects the backend API to be available at `http://localhost:3000`. Ensure the backend service is started before interacting with the dashboard.

## Testing

Run the unit tests (using Vitest and React Testing Library):

```bash
npm run test
```

## Project Structure

- `src/components`: React components (JobDashboard, etc.)
- `src/test`: Test setup and configuration
- `vite.config.ts`: Vite configuration
- `vite.test.config.ts`: Test configuration
