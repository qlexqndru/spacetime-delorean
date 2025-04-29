'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSpacetimeDB, useCurrentPoll, useOptions, useVotes, usePresentationState } from '@/lib/spacetimedb';
import { QRCodeSVG } from 'qrcode.react';

export default function PresentationPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session') || '';
  const { connected, joinSession } = useSpacetimeDB();
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  
  const currentPoll = useCurrentPoll();
  const presentationState = usePresentationState();
  const options = useOptions(currentPoll?.poll_id || 0);
  const votes = useVotes(currentPoll?.poll_id || 0);

  // Set base URL for QR code
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol;
      const host = window.location.host;
      setBaseUrl(`${protocol}//${host}`);
    }
  }, []);

  // Join session when connected
  useEffect(() => {
    if (connected && sessionId && !isJoining && !hasJoined) {
      handleJoinAsViewer();
    }
  }, [connected, sessionId]);

  const handleJoinAsViewer = async () => {
    if (!connected || !sessionId) return;
    
    setIsJoining(true);
    try {
      await joinSession(sessionId, 'user'); // Join as user to view the presentation
      setHasJoined(true);
    } catch (error) {
      console.error('Failed to join as viewer:', error);
    } finally {
      setIsJoining(false);
    }
  };

  // Calculate vote counts and percentages
  const getVoteCounts = () => {
    return options.map(option => {
      const count = votes.filter(v => v.option_id === option.option_id).length;
      const percentage = votes.length > 0 ? Math.round((count / votes.length) * 100) : 0;
      return {
        ...option,
        count,
        percentage,
      };
    });
  };

  const voteUrl = `${baseUrl}/vote?session=${sessionId}`;

  // Render loading state
  if (!connected || isJoining) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="card text-center p-8">
          <h1 className="text-2xl font-bold mb-4">Connecting to presentation view...</h1>
          <div className="animate-pulse flex space-x-4 justify-center">
            <div className="h-3 w-3 bg-primary rounded-full"></div>
            <div className="h-3 w-3 bg-primary rounded-full"></div>
            <div className="h-3 w-3 bg-primary rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  // Render waiting state
  if (!currentPoll || !presentationState || presentationState.state === 'waiting') {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="bg-primary text-white p-6">
          <h1 className="text-3xl font-bold">Real-time Voting</h1>
          <p className="mt-2">Session: {sessionId}</p>
        </header>
        
        <div className="flex-grow flex flex-col items-center justify-center p-8">
          <h2 className="text-3xl font-bold mb-8">Waiting for the first question...</h2>
          
          <div className="max-w-md text-center mb-12">
            <p className="text-xl mb-6">Join the voting session:</p>
            <div className="bg-white p-6 rounded-lg shadow-md inline-block">
              {baseUrl && <QRCodeSVG value={voteUrl} size={200} />}
            </div>
            <p className="mt-4 text-gray-600">
              Or visit: <span className="font-medium">{voteUrl}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render ended state
  if (presentationState.state === 'ended') {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="bg-primary text-white p-6">
          <h1 className="text-3xl font-bold">Real-time Voting</h1>
          <p className="mt-2">Session: {sessionId}</p>
        </header>
        
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-6">Voting has ended</h2>
            <p className="text-xl text-gray-600">Thank you for participating!</p>
          </div>
        </div>
      </div>
    );
  }

  // Get vote counts for the current poll
  const optionVoteCounts = getVoteCounts();
  
  // Sort options by vote count (for results view)
  const sortedOptions = [...optionVoteCounts].sort((a, b) => b.count - a.count);

  // Render results view
  if (presentationState.state === 'results') {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="bg-primary text-white p-6">
          <h1 className="text-3xl font-bold">Real-time Voting</h1>
          <p className="mt-2">Session: {sessionId}</p>
        </header>
        
        <div className="flex-grow p-8">
          <h2 className="text-3xl font-bold mb-8 text-center">{currentPoll.question}</h2>
          
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 gap-8">
              {sortedOptions.map((option) => (
                <div key={option.option_id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold">{option.text}</h3>
                    <div className="text-2xl font-bold text-primary">{option.percentage}%</div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${option.percentage}%` }}
                    ></div>
                  </div>
                  <div className="mt-2 text-gray-600 text-right">
                    {option.count} {option.count === 1 ? 'vote' : 'votes'}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-8 text-center text-xl">
              Total votes: <span className="font-bold">{votes.length}</span>
            </div>
          </div>
        </div>
        
        <footer className="bg-gray-100 p-4 text-center text-gray-600">
          <p>Scan the QR code or visit {voteUrl} to vote</p>
        </footer>
      </div>
    );
  }

  // Render voting view
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-primary text-white p-6">
        <h1 className="text-3xl font-bold">Real-time Voting</h1>
        <p className="mt-2">Session: {sessionId}</p>
      </header>
      
      <div className="flex-grow flex flex-col md:flex-row">
        <div className="flex-grow p-8">
          <h2 className="text-3xl font-bold mb-8 text-center">{currentPoll.question}</h2>
          
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {options.map((option) => (
              <div key={option.option_id} className="bg-white rounded-lg shadow-md p-6 text-center">
                <h3 className="text-xl font-bold">{option.text}</h3>
              </div>
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <div className="inline-block bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded">
              <p className="text-xl">Voting in progress...</p>
              <p className="mt-2">Total votes so far: <span className="font-bold">{votes.length}</span></p>
            </div>
          </div>
        </div>
        
        <div className="md:w-80 p-8 bg-gray-50 flex flex-col items-center justify-center">
          <div className="text-center">
            <h3 className="text-xl font-bold mb-4">Join the voting</h3>
            <div className="bg-white p-4 rounded-lg shadow-md inline-block">
              {baseUrl && <QRCodeSVG value={voteUrl} size={160} />}
            </div>
            <p className="mt-4 text-sm text-gray-600 break-all">
              Or visit: <span className="font-medium">{voteUrl}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
