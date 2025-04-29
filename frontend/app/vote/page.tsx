'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSpacetimeDB, useCurrentPoll, useOptions, useVotes, usePresentationState } from '@/lib/spacetimedb';

export default function VotePage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session') || '';
  const { connected, joinSession, submitVote } = useSpacetimeDB();
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  
  const currentPoll = useCurrentPoll();
  const presentationState = usePresentationState();
  const options = useOptions(currentPoll?.poll_id || 0);
  const votes = useVotes(currentPoll?.poll_id || 0);

  // Join session when connected
  useEffect(() => {
    if (connected && sessionId && !isJoining && !hasJoined) {
      handleJoinAsUser();
    }
  }, [connected, sessionId]);

  // Check if user has already voted
  useEffect(() => {
    if (currentPoll && votes.length > 0) {
      // In a real implementation, we would check if the user has voted based on their user_id
      // For now, we'll just set hasVoted to true if there are any votes
      setHasVoted(votes.some(v => v.user_id === 'user1')); // This would be the actual user_id
      
      // Find the user's vote and set the selected option
      const userVote = votes.find(v => v.user_id === 'user1'); // This would be the actual user_id
      if (userVote) {
        setSelectedOption(userVote.option_id);
      } else {
        setSelectedOption(null);
      }
    } else {
      setHasVoted(false);
      setSelectedOption(null);
    }
  }, [currentPoll, votes]);

  const handleJoinAsUser = async () => {
    if (!connected || !sessionId) return;
    
    setIsJoining(true);
    try {
      await joinSession(sessionId, 'user');
      setHasJoined(true);
    } catch (error) {
      console.error('Failed to join as user:', error);
    } finally {
      setIsJoining(false);
    }
  };

  const handleVote = async (optionId: number) => {
    if (!currentPoll || isSubmitting) return;
    
    setSelectedOption(optionId);
    setIsSubmitting(true);
    
    try {
      await submitVote(currentPoll.poll_id, optionId);
      setHasVoted(true);
    } catch (error) {
      console.error('Failed to submit vote:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render loading state
  if (!connected || isJoining) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="card text-center p-8">
          <h1 className="text-2xl font-bold mb-4">Connecting to voting session...</h1>
          <div className="animate-pulse flex space-x-4 justify-center">
            <div className="h-3 w-3 bg-primary rounded-full"></div>
            <div className="h-3 w-3 bg-primary rounded-full"></div>
            <div className="h-3 w-3 bg-primary rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  // Render waiting state if no active poll
  if (!currentPoll || !presentationState || presentationState.state === 'waiting' || presentationState.state === 'ended') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="card text-center p-8 max-w-md">
          <h1 className="text-2xl font-bold mb-4">
            {presentationState?.state === 'ended' 
              ? 'Voting has ended' 
              : 'Waiting for the next question...'}
          </h1>
          <p className="text-gray-600">
            {presentationState?.state === 'ended'
              ? 'Thank you for participating!'
              : 'The host will start the next question soon.'}
          </p>
        </div>
      </div>
    );
  }

  // Render results view
  if (presentationState.state === 'results') {
    // Calculate vote counts
    const optionVoteCounts = options.map(option => {
      const count = votes.filter(v => v.option_id === option.option_id).length;
      const percentage = votes.length > 0 ? Math.round((count / votes.length) * 100) : 0;
      return {
        ...option,
        count,
        percentage,
      };
    });
    
    return (
      <div className="min-h-screen p-4 bg-background">
        <div className="card max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-6">{currentPoll.question}</h1>
          <p className="mb-4 text-gray-600">Results:</p>
          
          <div className="space-y-4">
            {optionVoteCounts.map(option => (
              <div key={option.option_id} className="relative">
                <div className="flex justify-between mb-1">
                  <span className={`font-medium ${option.option_id === selectedOption ? 'text-primary' : ''}`}>
                    {option.text}
                  </span>
                  <span>{option.percentage}% ({option.count})</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${option.option_id === selectedOption ? 'bg-primary' : 'bg-gray-400'}`}
                    style={{ width: `${option.percentage}%` }}
                  ></div>
                </div>
                {option.option_id === selectedOption && (
                  <div className="absolute right-full mr-2 top-0 text-primary">
                    Your vote
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <p className="mt-6 text-sm text-gray-600 text-center">
            Total votes: {votes.length}
          </p>
        </div>
      </div>
    );
  }

  // Render voting view
  return (
    <div className="min-h-screen p-4 bg-background">
      <div className="card max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6">{currentPoll.question}</h1>
        
        <div className="space-y-3">
          {options.map(option => (
            <button
              key={option.option_id}
              className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                selectedOption === option.option_id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleVote(option.option_id)}
              disabled={isSubmitting}
            >
              {option.text}
            </button>
          ))}
        </div>
        
        {hasVoted && (
          <p className="mt-6 text-center text-green-600">
            Your vote has been recorded. You can change your vote by selecting another option.
          </p>
        )}
        
        {isSubmitting && (
          <div className="mt-6 text-center">
            <div className="animate-pulse flex space-x-4 justify-center">
              <div className="h-3 w-3 bg-primary rounded-full"></div>
              <div className="h-3 w-3 bg-primary rounded-full"></div>
              <div className="h-3 w-3 bg-primary rounded-full"></div>
            </div>
            <p className="text-gray-600 mt-2">Submitting your vote...</p>
          </div>
        )}
      </div>
    </div>
  );
}
