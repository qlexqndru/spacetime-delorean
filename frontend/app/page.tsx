'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useSpacetimeDB } from '@/lib/spacetimedb';
import Link from 'next/link';

export default function Home() {
  const { connected, joinSession } = useSpacetimeDB();
  const [sessionId, setSessionId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  // Generate a random session ID on component mount
  useEffect(() => {
    const randomId = Math.random().toString(36).substring(2, 10);
    setSessionId(randomId);
    
    // Get base URL for QR code
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol;
      // Use the actual hostname/IP and port from the browser
      const host = window.location.host;
      setBaseUrl(`${protocol}//${host}`);
      
      // Log the URL for debugging
      console.log(`QR code will use URL: ${protocol}//${host}/vote?session=${randomId}`);
    }
  }, []);

  // Join session as admin when connected
  useEffect(() => {
    if (connected && sessionId && !isJoining && !hasJoined) {
      handleJoinAsAdmin();
    }
  }, [connected, sessionId]);

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

  const voteUrl = `${baseUrl}/vote?session=${sessionId}`;

  return (
    <main className="min-h-screen flex flex-col">
      <header className="bg-primary text-white p-6">
        <h1 className="text-3xl font-bold">Real-time Voting App</h1>
        <p className="mt-2">A live interactive voting experience</p>
      </header>

      <div className="flex-grow flex flex-col md:flex-row">
        {/* Event Info */}
        <section className="flex-1 p-8">
          <div className="card max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Welcome to the Event</h2>
            <p className="mb-4">
              This is a real-time voting application that allows participants to vote on questions
              and see the results instantly.
            </p>
            <p className="mb-4">
              <strong>Session ID:</strong> {sessionId}
            </p>
            <div className="mt-8 space-y-4">
              <Link href={`/admin?session=${sessionId}`} className="btn btn-primary block text-center">
                Go to Admin Panel
              </Link>
              <Link href={`/presentation?session=${sessionId}`} className="btn btn-secondary block text-center">
                Open Presentation View
              </Link>
            </div>
          </div>
        </section>

        {/* QR Code */}
        <section className="flex-1 p-8 flex items-center justify-center bg-gray-50">
          <div className="card text-center">
            <h2 className="text-2xl font-bold mb-4">Join the Voting</h2>
            <p className="mb-6">Scan this QR code with your mobile device to participate:</p>
            
            <div className="bg-white p-4 inline-block rounded-lg">
              {baseUrl && <QRCodeSVG value={voteUrl} size={200} />}
            </div>
            
            <p className="mt-6 text-sm text-gray-600">
              Or visit: <a href={voteUrl} className="text-primary underline">{voteUrl}</a>
            </p>
          </div>
        </section>
      </div>

      <footer className="bg-gray-100 p-4 text-center text-gray-600">
        <p>&copy; {new Date().getFullYear()} Real-time Voting App. Built with SpacetimeDB and Next.js</p>
      </footer>
    </main>
  );
}
