import React, { useState } from 'react';

interface Props {
  isOpen: boolean;
  closePopup: () => void;
}

const EmailPopup: React.FC<Props> = ({ isOpen, closePopup }) => {
  const [email, setEmail] = useState<string>('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = `https://fitwithpulse.ai/.netlify/functions/add-email-to-mailing-list?email=${encodeURIComponent(email)}`;
    try {
      const response = await fetch(url, {
        method: 'GET'  // Changed to GET since we're passing data in the URL
      });
      const data = await response.json();
      console.log('Submission success:', data);
      closePopup();
    } catch (error) {
      console.error('Error submitting email:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        width: '400px',
        position: 'relative'
      }}>
        <button onClick={closePopup} style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '16px'
        }}>×</button>
        <h2 style={{
          fontSize: '24px',
          color: '#333',
          textAlign: 'center',
          marginBottom: '20px'
        }}>Subscribe</h2>
        <p style={{
          fontSize: '16px',
          color: '#555',
          textAlign: 'center',
          marginBottom: '20px'
        }}>Don't get left behind! Stay in the loop with the latest updates from Pulse.</p>
        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email address"
            required
            style={{
              fontSize: '16px',
              padding: '10px 15px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              marginBottom: '20px',
              width: '100%'
            }}
          />
          <button type="submit" style={{
            background: '#007BFF',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '10px 20px',
            cursor: 'pointer',
            fontSize: '16px'
          }}>Notify Me</button>
        </form>
      </div>
    </div>
  );
};

export default EmailPopup;
