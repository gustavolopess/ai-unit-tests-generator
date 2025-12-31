import { useState } from 'react';
import './App.css';
import { JobCreator } from './components/JobCreator';
import { JobDashboard } from './components/JobDashboard';

function App() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  return (
    <div className="app-container">
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', background: 'linear-gradient(to right, #646cff, #9f1239)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          CovBumperAI
        </h1>
        <p style={{ color: '#888' }}>
          Automated test coverage analysis, generation, and PR creation
        </p>
      </header>

      <main>
        {currentJobId ? (
          <JobDashboard
            jobId={currentJobId}
            onBack={() => setCurrentJobId(null)}
            onSwitchJob={setCurrentJobId}
          />
        ) : (
          <JobCreator onJobCreated={setCurrentJobId} />
        )}
      </main>
    </div>
  );
}

export default App;
