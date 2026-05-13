import React from 'react';

const LEGACY_UI_URL = 'http://localhost:8081/index.html';

export default function App() {
  return (
    <main style={{ width: '100%', height: '100%', margin: 0, padding: 0, background: '#0b1020', overflow: 'hidden' }}>
      <iframe
        title="NexTrade Legacy UI"
        src={LEGACY_UI_URL}
        style={{ border: 'none', width: '100%', height: '100%', display: 'block' }}
      />
    </main>
  );
}
