import React from 'react';

// This component has violations that should be detected
export const Button: React.FC<{ label: string }> = ({ label }) => {
  // Inline style violation
  return (
    <button style={{ padding: 100, margin: 200, color: '#ff0000' }}>
      {label}
    </button>
  );
};

// Magic number violation (500 > threshold of 100)
const width = 500;

export default Button;

