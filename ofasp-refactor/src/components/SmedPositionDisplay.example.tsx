import React, { useState, useEffect } from 'react';
import SmedPositionDisplay from './SmedPositionDisplay';

// Example usage of SmedPositionDisplay component
const SmedPositionDisplayExample: React.FC = () => {
  // Sample position-based field definitions
  const [mapData] = useState([
    { row: 1, col: 1, length: 20 },   // Title field
    { row: 3, col: 5, length: 10 },   // Employee ID
    { row: 3, col: 25, length: 25 },  // Employee Name
    { row: 5, col: 5, length: 15 },   // Department
    { row: 5, col: 30, length: 12 },  // Phone Number
    { row: 7, col: 5, length: 30 },   // Address Line 1
    { row: 8, col: 5, length: 30 },   // Address Line 2
    { row: 10, col: 5, length: 15 },  // City
    { row: 10, col: 25, length: 10 }, // State
    { row: 10, col: 40, length: 10 }, // ZIP Code
    { row: 12, col: 5, length: 25 },  // Email
    { row: 14, col: 5, length: 50 },  // Notes
  ]);

  // Sample initial data corresponding to the fields above
  const [fieldData, setFieldData] = useState([
    'EMPLOYEE INFORMATION', // Title
    'EMP001',              // Employee ID
    'TANAKA HIROSHI',      // Employee Name (Japanese)
    'DEVELOPMENT',         // Department
    '03-1234-5678',       // Phone Number
    '123 SHIBUYA STREET',  // Address Line 1
    'SHIBUYA-KU',         // Address Line 2
    'TOKYO',              // City
    'TOKYO',              // State
    '150-0002',           // ZIP Code
    'tanaka@company.jp',   // Email
    'Senior Developer - Full Stack Development', // Notes
  ]);

  const [isDarkMode, setIsDarkMode] = useState(false);

  // Handle data changes from the component
  const handleDataChange = (newData: string[]) => {
    console.log('Data changed:', newData);
    setFieldData(newData);
  };

  // Handle key events from the component
  const handleKeyEvent = (key: string, data: string[]) => {
    console.log('Key event:', key, 'Data:', data);
    
    switch (key) {
      case 'F1':
        alert('Help: Use Tab to navigate fields, Enter to submit, F3 to exit');
        break;
      case 'F3':
        alert('Exit requested');
        break;
      case 'F12':
        // Toggle some demo functionality
        setIsDarkMode(!isDarkMode);
        break;
      case 'ENTER':
        alert(`Form submitted with ${data.length} fields`);
        break;
      default:
        console.log(`Unhandled key: ${key}`);
    }
  };

  // Simulate WebSocket data updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate updating the timestamp in notes field
      const now = new Date().toLocaleTimeString();
      setFieldData(prev => {
        const updated = [...prev];
        updated[11] = `Last updated: ${now}`; // Update notes field
        return updated;
      });
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '20px', backgroundColor: isDarkMode ? '#1a1a1a' : '#f0f0f0', minHeight: '100vh' }}>
      <h1 style={{ color: isDarkMode ? '#ffffff' : '#000000', marginBottom: '20px' }}>
        SMED Position Display Example
      </h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          style={{
            padding: '10px 20px',
            marginRight: '10px',
            backgroundColor: isDarkMode ? '#444' : '#ddd',
            color: isDarkMode ? '#fff' : '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {isDarkMode ? 'Light Mode' : 'Dark Mode'}
        </button>
        
        <button 
          onClick={() => setFieldData(prev => prev.map((field, index) => 
            index === 0 ? 'UPDATED EMPLOYEE INFO' : field
          ))}
          style={{
            padding: '10px 20px',
            marginRight: '10px',
            backgroundColor: '#007700',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Update Title
        </button>
        
        <button 
          onClick={() => setFieldData([
            'NEW EMPLOYEE FORM',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            'Please fill out all fields'
          ])}
          style={{
            padding: '10px 20px',
            backgroundColor: '#770000',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clear Form
        </button>
      </div>

      <SmedPositionDisplay
        mapName="EMPLOYEE_FORM"
        mapData={mapData}
        initialData={fieldData}
        onDataChange={handleDataChange}
        onKeyEvent={handleKeyEvent}
        isDarkMode={isDarkMode}
      />

      <div style={{ 
        marginTop: '30px', 
        padding: '20px', 
        backgroundColor: isDarkMode ? '#333' : '#fff',
        border: `1px solid ${isDarkMode ? '#666' : '#ccc'}`,
        borderRadius: '8px',
        color: isDarkMode ? '#fff' : '#000'
      }}>
        <h3>Usage Instructions:</h3>
        <ul>
          <li><strong>Navigation:</strong> Click on fields or use Tab to move between fields</li>
          <li><strong>Input:</strong> Type directly in focused fields (indicated by green highlight)</li>
          <li><strong>Function Keys:</strong>
            <ul>
              <li>F1 - Show help</li>
              <li>F3 - Exit/Close</li>
              <li>F12 - Toggle dark mode</li>
              <li>Enter - Submit form</li>
            </ul>
          </li>
          <li><strong>Features:</strong>
            <ul>
              <li>24x80 terminal grid with exact positioning</li>
              <li>Full-width character support (CJK)</li>
              <li>Real-time WebSocket integration</li>
              <li>Position-based field mapping (no field names)</li>
              <li>Index-based data matching</li>
            </ul>
          </li>
        </ul>

        <h3>Current Field Data:</h3>
        <pre style={{ 
          backgroundColor: isDarkMode ? '#222' : '#f8f8f8',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          overflow: 'auto'
        }}>
          {JSON.stringify(fieldData, null, 2)}
        </pre>

        <h3>Field Positions:</h3>
        <pre style={{ 
          backgroundColor: isDarkMode ? '#222' : '#f8f8f8',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          overflow: 'auto'
        }}>
          {JSON.stringify(mapData, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default SmedPositionDisplayExample;