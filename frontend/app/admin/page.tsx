'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSpacetimeDB, usePolls, useCurrentPoll, useOptions, useVotes, usePresentationState } from '@/lib/spacetimedb';
import Link from 'next/link';

export default function AdminPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session') || '';
  const { 
    connected, 
    joinSession, 
    createPoll, 
    activatePoll, 
    showResults, 
    endSession,
    getUserRole 
  } = useSpacetimeDB();
  
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // New poll form state
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '', '', '']);
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  
  // Get data from SpacetimeDB
  const polls = usePolls();
  const currentPoll = useCurrentPoll();
  const presentationState = usePresentationState();
  const options = useOptions(currentPoll?.poll_id || 0);
  const votes = useVotes(currentPoll?.poll_id || 0);

  // Join session when connected
  useEffect(() => {
    if (connected && sessionId && !isJoining && !hasJoined) {
      handleJoinAsAdmin();
    }
  }, [connected, sessionId]);

  // Check if user is admin
  useEffect(() => {
    if (hasJoined) {
      const role = getUserRole();
      setIsAdmin(role === 'admin');
    }
  }, [hasJoined, getUserRole]);

  const handleJoinAsAdmin = async () => {
    if (!connected || !sessionId) return;
    
    setIsJoining(true);
    try {
      await joinSession(sessionId, 'admin');
      setHasJoined(true);
    } catch (error) {
      console.error('Failed to join as admin:', error);
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPollQuestion.trim() || isCreatingPoll) return;
    
    // Filter out empty options
    const filteredOptions = newPollOptions.filter(opt => opt.trim() !== '');
    
    if (filteredOptions.length < 2) {
      alert('Please provide at least 2 options');
      return;
    }
    
    setIsCreatingPoll(true);
    
    try {
      await createPoll(newPollQuestion, filteredOptions);
      
      // Reset form
      setNewPollQuestion('');
      setNewPollOptions(['', '', '', '']);
    } catch (error) {
      console.error('Failed to create poll:', error);
    } finally {
      setIsCreatingPoll(false);
    }
  };

  const handleActivatePoll = async (pollId: number) => {
    try {
      await activatePoll(pollId);
    } catch (error) {
      console.error('Failed to activate poll:', error);
    }
  };

  const handleShowResults = async () => {
    try {
      await showResults();
    } catch (error) {
      console.error('Failed to show results:', error);
    }
  };

  const handleEndSession = async () => {
    if (window.confirm('Are you sure you want to end the session? This will end voting for all participants.')) {
      try {
        await endSession();
      } catch (error) {
        console.error('Failed to end session:', error);
      }
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const updatedOptions = [...newPollOptions];
    updatedOptions[index] = value;
    setNewPollOptions(updatedOptions);
  };

  const addOption = () => {
    setNewPollOptions([...newPollOptions, '']);
  };

  const removeOption = (index: number) => {
    if (newPollOptions.length <= 2) return;
    const updatedOptions = newPollOptions.filter((_, i) => i !== index);
    setNewPollOptions(updatedOptions);
  };

  // Calculate vote counts for the current poll
  const getVoteCounts = () => {
    if (!currentPoll) return [];
    
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

  // Render loading state
  if (!connected || isJoining) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="card text-center p-8">
          <h1 className="text-2xl font-bold mb-4">Connecting to admin panel...</h1>
          <div className="animate-pulse flex space-x-4 justify-center">
            <div className="h-3 w-3 bg-primary rounded-full"></div>
            <div className="h-3 w-3 bg-primary rounded-full"></div>
            <div className="h-3 w-3 bg-primary rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  // Render unauthorized state
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="card text-center p-8 max-w-md">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Access Denied</h1>
          <p className="mb-6">You do not have permission to access the admin panel.</p>
          <Link href="/" className="btn btn-primary">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-primary text-white p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <div className="flex space-x-4">
            <Link 
              href={`/presentation?session=${sessionId}`} 
              target="_blank"
              className="btn bg-white/20 hover:bg-white/30"
            >
              Open Presentation
            </Link>
            <button 
              onClick={handleEndSession} 
              className="btn bg-red-500 hover:bg-red-600"
              disabled={presentationState?.state === 'ended'}
            >
              End Session
            </button>
          </div>
        </div>
        <p className="mt-2">Session: {sessionId}</p>
      </header>
      
      <div className="flex-grow p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Poll Status */}
          <div className="lg:col-span-2">
            <div className="card mb-6">
              <h2 className="text-xl font-bold mb-4">Current Status</h2>
              {presentationState?.state === 'ended' ? (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
                  <p className="font-bold">Session has ended</p>
                  <p>No active polls</p>
                </div>
              ) : currentPoll ? (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">{currentPoll.question}</h3>
                    <div className="flex space-x-2">
                      {presentationState?.state === 'voting' && (
                        <button 
                          onClick={handleShowResults} 
                          className="btn btn-secondary"
                        >
                          Show Results
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-gray-600 mb-2">
                      Status: <span className="font-medium capitalize">{presentationState?.state}</span>
                    </p>
                    <p className="text-gray-600">
                      Total votes: <span className="font-medium">{votes.length}</span>
                    </p>
                  </div>
                  
                  <div className="space-y-3 mt-6">
                    {getVoteCounts().map((option) => (
                      <div key={option.option_id} className="bg-gray-50 p-3 rounded">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium">{option.text}</span>
                          <span>{option.count} votes ({option.percentage}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className="bg-primary h-2.5 rounded-full" 
                            style={{ width: `${option.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded">
                  <p>No active poll</p>
                  <p>Create a new poll or activate an existing one</p>
                </div>
              )}
            </div>
            
            {/* Poll List */}
            <div className="card">
              <h2 className="text-xl font-bold mb-4">All Polls</h2>
              {polls.length === 0 ? (
                <p className="text-gray-600">No polls created yet</p>
              ) : (
                <div className="space-y-4">
                  {polls.map((poll) => (
                    <div 
                      key={poll.poll_id} 
                      className={`border rounded-lg p-4 ${
                        poll.is_active ? 'border-primary bg-primary/5' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-medium">{poll.question}</h3>
                          <p className="text-sm text-gray-600">
                            {poll.is_active ? (
                              <span className="text-primary font-medium">Active</span>
                            ) : (
                              <span>Inactive</span>
                            )}
                          </p>
                        </div>
                        {!poll.is_active && presentationState?.state !== 'ended' && (
                          <button 
                            onClick={() => handleActivatePoll(poll.poll_id)} 
                            className="btn btn-primary"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Create New Poll */}
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Create New Poll</h2>
            <form onSubmit={handleCreatePoll}>
              <div className="mb-4">
                <label htmlFor="question" className="block text-gray-700 mb-2">
                  Question
                </label>
                <input
                  type="text"
                  id="question"
                  className="input w-full"
                  placeholder="Enter your question"
                  value={newPollQuestion}
                  onChange={(e) => setNewPollQuestion(e.target.value)}
                  required
                  disabled={presentationState?.state === 'ended'}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  Options
                </label>
                {newPollOptions.map((option, index) => (
                  <div key={index} className="flex mb-2">
                    <input
                      type="text"
                      className="input flex-grow"
                      placeholder={`Option ${index + 1}`}
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      required={index < 2}
                      disabled={presentationState?.state === 'ended'}
                    />
                    {index >= 2 && (
                      <button
                        type="button"
                        className="ml-2 text-red-500 hover:text-red-700"
                        onClick={() => removeOption(index)}
                        disabled={presentationState?.state === 'ended'}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                
                {newPollOptions.length < 8 && (
                  <button
                    type="button"
                    className="text-primary hover:text-primary/80 text-sm mt-2"
                    onClick={addOption}
                    disabled={presentationState?.state === 'ended'}
                  >
                    + Add Option
                  </button>
                )}
              </div>
              
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isCreatingPoll || presentationState?.state === 'ended'}
              >
                {isCreatingPoll ? 'Creating...' : 'Create Poll'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
