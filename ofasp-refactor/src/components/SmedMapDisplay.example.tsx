import React from 'react';
import SmedMapDisplay from './SmedMapDisplay';

// Example usage of SmedMapDisplay component
const SmedMapDisplayExample: React.FC = () => {
  // Example SMED fields data from API response
  const sampleFields = [
    // Output fields (with PROMPT)
    {
      name: "TITLE",
      row: 2,
      col: 25,
      length: 30,
      prompt: "SMED MAP DISPLAY EXAMPLE"
    },
    {
      name: "USERLBL",
      row: 5,
      col: 10,
      length: 10,
      prompt: "Username:"
    },
    {
      name: "PASSLBL",
      row: 7,
      col: 10,
      length: 10,
      prompt: "Password:"
    },
    {
      name: "DATELBL",
      row: 10,
      col: 10,
      length: 15,
      prompt: "Date of Birth:"
    },
    {
      name: "EMAILLBL",
      row: 12,
      col: 10,
      length: 7,
      prompt: "Email:"
    },
    {
      name: "MSG",
      row: 20,
      col: 10,
      length: 60,
      prompt: "Press ENTER to submit, TAB to move between fields"
    },
    
    // Input fields (without PROMPT)
    {
      name: "USERNAME",
      row: 5,
      col: 21,
      length: 20,
      value: ""
    },
    {
      name: "PASSWORD",
      row: 7,
      col: 21,
      length: 20,
      value: ""
    },
    {
      name: "DOB",
      row: 10,
      col: 26,
      length: 10,
      value: ""
    },
    {
      name: "EMAIL",
      row: 12,
      col: 18,
      length: 30,
      value: ""
    }
  ];

  const handleSubmit = (fieldValues: Record<string, string>) => {
    console.log('Submitted field values:', fieldValues);
    // Here you would typically send the data to your API
    // Example:
    // fetch('/api/smed/submit', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ fields: fieldValues })
    // });
    
    alert(`Form submitted!\n${JSON.stringify(fieldValues, null, 2)}`);
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      <h1 style={{ color: '#00ff00', marginBottom: '20px' }}>SMED Map Display Example</h1>
      
      <SmedMapDisplay
        fields={sampleFields}
        onSubmit={handleSubmit}
        mapName="USERFORM"
      />
      
      <div style={{ marginTop: '40px', color: '#00ff00' }}>
        <h2>Instructions:</h2>
        <ul>
          <li>Click on any green input field to focus it</li>
          <li>Type to enter text</li>
          <li>Press TAB to move to the next field</li>
          <li>Press ENTER to submit the form</li>
          <li>Use BACKSPACE to delete characters</li>
        </ul>
      </div>
    </div>
  );
};

export default SmedMapDisplayExample;