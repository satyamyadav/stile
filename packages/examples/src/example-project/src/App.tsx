import React from 'react';
import { Card } from './Card';

// Main app component with magic number
export const App: React.FC = () => {
  // Magic number violation (1200 > threshold of 100)
  const maxWidth = 1200;
  
  return (
    <div style={{ maxWidth: maxWidth }}>
      <Card title="Welcome" />
    </div>
  );
};

export default App;

