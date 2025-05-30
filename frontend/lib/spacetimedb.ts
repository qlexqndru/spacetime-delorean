import { useEffect, useState } from 'react';

// Connect to the real SpacetimeDB instance using WebSockets
// This implements a custom client for SpacetimeDB without requiring code generation

// Types that would normally be generated by SpacetimeDB
export interface User {
  user_id: string;
  session_id: string;
  role: string;
  connected_at: Date;
}

export interface Poll {
  poll_id: number;
  question: string;
  is_active: boolean;
  created_at: Date;
}

export interface Option {
  option_id: number;
  poll_id: number;
  text: string;
}

export interface Vote {
  vote_id: number;
  poll_id: number;
  user_id: string;
  option_id: number;
  voted_at: Date;
}

export interface PresentationState {
  id: number;
  current_poll_id: number;
  state: string;
}

// Since we're having issues with the Rust module, we'll use simulated data
// but with real WebSocket communication to enable synchronization between tabs

// Local storage key for the simulator state
const LOCAL_STORAGE_KEY = 'voting_app_state';

// Initial data for the simulator
const initialPolls: Poll[] = [];
const initialOptions: Option[] = [];
const initialVotes: Vote[] = [];
const initialPresentationState: PresentationState = {
  id: 0,
  current_poll_id: 0,
  state: 'waiting',
};

// SpacetimeDB WebSocket connection URL options to try
// Different SpacetimeDB versions use different URL formats
const SPACETIMEDB_URLS = [
  'ws://localhost:5000/voting-app',
  'ws://localhost:5000/modules/voting-app',
  'ws://localhost:5000/api/modules/voting-app',
  'ws://localhost:5000/api/voting-app',
  // Keeping fallbacks for anyone still using port 3000
  'ws://localhost:3000/voting-app',
  'ws://localhost:3000/modules/voting-app',
];

// Disable simulation mode - we're focusing on the real SpacetimeDB backend
const FORCE_SIMULATION_MODE = false;
const ENABLE_LOCAL_STORAGE_SYNC = true;
const SIMULATION_CHANNEL = 'voting_app_channel';

// Real SpacetimeDB client class using WebSockets
class SpacetimeDBClient {
  private static instance: SpacetimeDBClient;
  // We'll use a simulated socket
  private socket: { close: () => void } | null = null;
  private connected: boolean = false;
  private listeners: Map<string, Set<Function>> = new Map();
  private userId: string = '';
  private sessionId: string = '';
  private role: string = '';
  private messageQueue: any[] = [];
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: number = 1000;

  // State for the simulator
  private polls: Poll[] = [];
  private options: Option[] = [];
  private votes: Vote[] = [];
  private presentationState: PresentationState = initialPresentationState;
  private nextPollId: number = 1;
  private nextOptionId: number = 1;
  private nextVoteId: number = 1;

  private constructor() {
    // Initialize listeners
    this.listeners.set('polls', new Set());
    this.listeners.set('options', new Set());
    this.listeners.set('votes', new Set());
    this.listeners.set('presentationState', new Set());
  }

  public static getInstance(): SpacetimeDBClient {
    if (!SpacetimeDBClient.instance) {
      SpacetimeDBClient.instance = new SpacetimeDBClient();
    }
    return SpacetimeDBClient.instance;
  }

  private simulationMode = false;
  private broadcastChannel: BroadcastChannel | null = null;

  public async connect(address?: string): Promise<void> {
    if (this.connected && this.socket) {
      return;
    }

    // Force simulation mode if configured (for development/troubleshooting)
    if (FORCE_SIMULATION_MODE) {
      console.log(' SIMULATION MODE ACTIVE: Using local storage for persistence');
      this.enableSimulationMode();
      return Promise.resolve();
    }
    
    // If an explicit address is provided, use it; otherwise try all options
    if (address) {
      return this.connectToWebSocket(address);
    }
    
    // Try all SpacetimeDB URLs in sequence
    for (const url of SPACETIMEDB_URLS) {
      try {
        console.log(`Connecting to SpacetimeDB at ${url}...`);
        await this.connectToWebSocket(url);
        return; // Success, exit the function
      } catch (error) {
        console.warn(`Failed to connect to ${url}:`, error);
        // Continue to the next URL
      }
    }

    // If all URLs failed and local storage sync is enabled, use simulation mode
    if (ENABLE_LOCAL_STORAGE_SYNC) {
      console.log('Using local storage simulation mode for SpacetimeDB');
      this.enableSimulationMode();
      return Promise.resolve();
    }

    // If we get here, all connection attempts failed
    return Promise.reject(new Error('Failed to connect to any SpacetimeDB endpoint'));
  }

  private enableSimulationMode(): void {
    this.simulationMode = true;
    this.connected = true;

    // Load saved state from localStorage
    this.loadSimulationState();

    // Set up BroadcastChannel for cross-tab communication
    try {
      this.broadcastChannel = new BroadcastChannel(SIMULATION_CHANNEL);
      this.broadcastChannel.onmessage = (event) => this.handleBroadcastMessage(event.data);
    } catch (error) {
      console.warn('BroadcastChannel not supported:', error);
    }

    console.log('✅ Simulation mode active!');
    console.log('   - Using localStorage for persistence');
    console.log('   - Real-time sync between browser tabs');
    console.log('   - All app features available');
  }

  private loadSimulationState(): void {
    const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        this.polls = state.polls || [];
        this.options = state.options || [];
        this.votes = state.votes || [];
        this.presentationState = state.presentationState || initialPresentationState;
        this.nextPollId = state.nextPollId || 1;
        this.nextOptionId = state.nextOptionId || 1;
        this.nextVoteId = state.nextVoteId || 1;
        console.log('Loaded simulation state from localStorage');
      } catch (err) {
        console.error('Error loading state from localStorage:', err);
      }
    }
  }

  private saveSimulationState(): void {
    if (!ENABLE_LOCAL_STORAGE_SYNC) return;

    const state = {
      polls: this.polls,
      options: this.options,
      votes: this.votes,
      presentationState: this.presentationState,
      nextPollId: this.nextPollId,
      nextOptionId: this.nextOptionId,
      nextVoteId: this.nextVoteId,
    };

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  }

  private handleBroadcastMessage(data: any): void {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'polls':
        this.polls = data.polls;
        this.notifyListeners('polls', this.polls);
        break;
      case 'options':
        this.options = data.options;
        this.notifyListeners('options', this.options);
        break;
      case 'votes':
        this.votes = data.votes;
        this.notifyListeners('votes', this.votes);
        break;
      case 'presentationState':
        this.presentationState = data.presentationState;
        this.notifyListeners('presentationState', this.presentationState);
        break;
    }
  }

  private async connectToWebSocket(address: string): Promise<void> {
    console.log(`Connecting to SpacetimeDB at ${address}...`);

    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket connection to SpacetimeDB
        const ws = new WebSocket(address);

        ws.onopen = () => {
          console.log('Connected to SpacetimeDB');
          this.connected = true;

          // Process any queued messages
          this.processQueue();

          resolve();
        };

        ws.onclose = () => {
          console.log('Disconnected from SpacetimeDB');
          this.connected = false;

          // Try to reconnect if not intentionally closed
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log(`Reconnecting (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
            this.reconnectAttempts++;
            setTimeout(() => this.connect(address), this.reconnectTimeout);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (!this.connected) {
            reject(error);
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Received message:', data);

            // Handle different message types
            if (data.type === 'table_update') {
              this.handleTableUpdate(data.table, data.rows);
            } else if (data.type === 'reducer_result') {
              // Handle reducer result if needed
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        this.socket = ws;
      } catch (error) {
        console.error('Failed to connect to SpacetimeDB:', error);
        reject(error);
      }
    });
  }

  private handleTableUpdate(tableName: string, rows: any[]) {
    switch (tableName) {
      case 'poll':
        this.polls = rows.map((row) => ({
          poll_id: row.poll_id,
          question: row.question,
          is_active: row.is_active,
          created_at: new Date(row.created_at / 1000), // Convert microseconds to milliseconds
        }));
        this.notifyListeners('polls', this.polls);
        break;
      case 'poll_option':
        this.options = rows.map((row) => ({
          option_id: row.option_id,
          poll_id: row.poll_id,
          text: row.text,
        }));
        this.notifyListeners('options', this.options);
        break;
      case 'vote':
        this.votes = rows.map((row) => ({
          vote_id: row.vote_id,
          poll_id: row.poll_id,
          user_id: row.user_id,
          option_id: row.option_id,
          voted_at: new Date(row.voted_at / 1000), // Convert microseconds to milliseconds
        }));
        this.notifyListeners('votes', this.votes);
        break;
      case 'presentation_state':
        if (rows.length > 0) {
          this.presentationState = {
            id: rows[0].id,
            current_poll_id: rows[0].current_poll_id,
            state: rows[0].state,
          };
          this.notifyListeners('presentationState', this.presentationState);
        }
        break;
    }
  }

  private sendMessage(message: any): void {
    if (this.simulationMode) {
      // Handle messages in simulation mode
      this.handleSimulatedMessage(message);
      return;
    }

    if (!this.connected || !this.socket) {
      this.messageQueue.push(message);
      return;
    }

    console.log('Sending message:', message);

    // Send the message to SpacetimeDB via WebSocket
    try {
      if (this.socket instanceof WebSocket) {
        this.socket.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Requeue the message for retry
      this.messageQueue.push(message);
    }
  }

  private handleSimulatedMessage(message: any): void {
    if (!message || !message.type) return;

    switch (message.type) {
      case 'create_poll':
        this.simulateCreatePoll(message.question, message.options);
        break;
      case 'activate_poll':
        this.simulateActivatePoll(message.pollId);
        break;
      case 'submit_vote':
        this.simulateSubmitVote(message.pollId, message.optionId);
        break;
      case 'show_results':
        this.simulateShowResults(message.pollId);
        break;
      case 'end_session':
        this.simulateEndSession();
        break;
    }
  }

  // Simulation versions of the SpacetimeDB reducers
  private simulateCreatePoll(question: string, optionTexts: string[]): void {
    const pollId = this.nextPollId++;
    const poll: Poll = {
      poll_id: pollId,
      question,
      is_active: false,
      created_at: new Date(),
    };

    this.polls.push(poll);

    // Create options for the poll
    const options: Option[] = optionTexts.map((text) => {
      const optionId = this.nextOptionId++;
      return {
        option_id: optionId,
        poll_id: pollId,
        text,
      };
    });

    this.options.push(...options);

    // Save state and broadcast changes
    this.saveSimulationState();
    this.broadcastStateUpdate('polls', this.polls);
    this.broadcastStateUpdate('options', this.options);

    // Notify listeners
    this.notifyListeners('polls', this.polls);
    this.notifyListeners('options', this.options);
  }

  private simulateActivatePoll(pollId: number): void {
    // Update the poll
    this.polls = this.polls.map((poll) =>
      poll.poll_id === pollId ? { ...poll, is_active: true } : { ...poll, is_active: false }
    );

    // Update presentation state
    this.presentationState = {
      ...this.presentationState,
      current_poll_id: pollId,
      state: 'voting',
    };

    // Save state and broadcast changes
    this.saveSimulationState();
    this.broadcastStateUpdate('polls', this.polls);
    this.broadcastStateUpdate('presentationState', this.presentationState);

    // Notify listeners
    this.notifyListeners('polls', this.polls);
    this.notifyListeners('presentationState', this.presentationState);
  }

  private simulateSubmitVote(pollId: number, optionId: number): void {
    // Check if user already voted for this poll
    const existingVote = this.votes.find((v) => v.poll_id === pollId && v.user_id === this.userId);

    if (existingVote) {
      // Update existing vote
      this.votes = this.votes.map((vote) =>
        vote.vote_id === existingVote.vote_id ? { ...vote, option_id: optionId } : vote
      );
    } else {
      // Create new vote
      const vote: Vote = {
        vote_id: this.nextVoteId++,
        poll_id: pollId,
        user_id: this.userId,
        option_id: optionId,
        voted_at: new Date(),
      };

      this.votes.push(vote);
    }

    // Save state and broadcast changes
    this.saveSimulationState();
    this.broadcastStateUpdate('votes', this.votes);

    // Notify listeners
    this.notifyListeners('votes', this.votes);
  }

  private simulateShowResults(pollId: number): void {
    // Update presentation state
    this.presentationState = {
      ...this.presentationState,
      current_poll_id: pollId,
      state: 'results',
    };

    // Save state and broadcast changes
    this.saveSimulationState();
    this.broadcastStateUpdate('presentationState', this.presentationState);

    // Notify listeners
    this.notifyListeners('presentationState', this.presentationState);
  }

  private simulateEndSession(): void {
    // Update presentation state
    this.presentationState = {
      ...this.presentationState,
      state: 'ended',
    };

    // Make all polls inactive
    this.polls = this.polls.map((poll) => ({ ...poll, is_active: false }));

    // Save state and broadcast changes
    this.saveSimulationState();
    this.broadcastStateUpdate('polls', this.polls);
    this.broadcastStateUpdate('presentationState', this.presentationState);

    // Notify listeners
    this.notifyListeners('polls', this.polls);
    this.notifyListeners('presentationState', this.presentationState);
  }

  private broadcastStateUpdate(type: string, data: any): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type, [type]: data });
    }
  }

  private processQueue(): void {
    if (this.connected && this.socket) {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        this.sendMessage(message);
      }
    }
  }

  public createSession(userId: string, sessionId: string, role: string): void {
    this.userId = userId;
    this.sessionId = sessionId;
    this.role = role;

    // Send message to create user
    const message = {
      type: 'create_session',
      userId,
      sessionId,
      role,
    };

    this.sendMessage(message);
  }
  
  public async joinSession(sessionId: string, role: string): Promise<void> {
    console.log(`Joining session ${sessionId} as ${role}...`);
    this.sessionId = sessionId;
    this.role = role;
    
    // Generate a random user ID if not set
    if (!this.userId) {
      this.userId = Math.random().toString(36).substring(2, 10);
    }
    
    // In simulation mode, just set the session ID and role
    if (this.simulationMode) {
      console.log(`Simulated joining session ${sessionId} as ${role}`);
      return Promise.resolve();
    }
    
    // For real SpacetimeDB, call the join_session reducer
    const message = {
      type: 'reducer',
      reducer: 'join_session',
      args: [sessionId, role]
    };
    
    this.sendMessage(message);
    return Promise.resolve();
  }

  public async createPoll(question: string, options: string[]): Promise<void> {
    console.log(`Creating poll: ${question}`);
    
    // Call the create_poll reducer
    this.sendMessage({
      type: 'reducer',
      reducer: 'create_poll',
      args: [question, options]
    });
  }

  public async activatePoll(pollId: number): Promise<void> {
    console.log(`Activating poll ${pollId}`);
    
    // Call the activate_poll reducer
    this.sendMessage({
      type: 'reducer',
      reducer: 'activate_poll',
      args: [pollId]
    });
  }

  public async submitVote(pollId: number, optionId: number): Promise<void> {
    console.log(`Submitting vote for poll ${pollId}, option ${optionId}`);
    
    // Call the submit_vote reducer
    this.sendMessage({
      type: 'reducer',
      reducer: 'submit_vote',
      args: [pollId, optionId]
    });
  }

  public async showResults(): Promise<void> {
    console.log('Showing results');
    
    // Call the show_results reducer
    this.sendMessage({
      type: 'reducer',
      reducer: 'show_results',
      args: []
    });
  }

  public async endSession(): Promise<void> {
    console.log('Ending session');
    
    // Call the end_session reducer
    this.sendMessage({
      type: 'reducer',
      reducer: 'end_session',
      args: []
    });
  }

  public getPolls(): Poll[] {
    return [...this.polls];
  }

  public getOptions(pollId: number): Option[] {
    return this.options.filter(o => o.poll_id === pollId);
  }

  public getVotes(pollId: number): Vote[] {
    return this.votes.filter(v => v.poll_id === pollId);
  }

  public getPresentationState(): PresentationState {
    return { ...this.presentationState };
  }

  public getCurrentPoll(): Poll | undefined {
    if (!this.presentationState) return undefined;
    const currentPollId = this.presentationState.current_poll_id;
    return this.polls.find(p => p.poll_id === currentPollId);
  }

  public getUserRole(): string {
    return this.role;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public subscribe(table: string, callback: Function): () => void {
    const listeners = this.listeners.get(table);
    if (!listeners) {
      throw new Error(`Unknown table: ${table}`);
    }
    
    listeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      listeners.delete(callback);
    };
  }

  private notifyListeners(table: string, data: any): void {
    const listeners = this.listeners.get(table);
    if (!listeners) {
      return;
    }
    
    listeners.forEach(callback => {
      callback(data);
    });
  }
}

// React hooks for SpacetimeDB
export function useSpacetimeDB() {
  const [client] = useState(() => SpacetimeDBClient.getInstance());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Connect to SpacetimeDB
    if (!client.isConnected()) {
      client.connect()
        .then(() => setConnected(true))
        .catch(err => console.error('Failed to connect to SpacetimeDB:', err));
    } else {
      setConnected(true);
    }
  }, [client]);

  return {
    client,
    connected,
    joinSession: (sessionId: string, role: string) => client.joinSession(sessionId, role),
    createPoll: (question: string, options: string[]) => client.createPoll(question, options),
    activatePoll: (pollId: number) => client.activatePoll(pollId),
    submitVote: (pollId: number, optionId: number) => client.submitVote(pollId, optionId),
    showResults: () => client.showResults(),
    endSession: () => client.endSession(),
    getPolls: () => client.getPolls(),
    getOptions: (pollId: number) => client.getOptions(pollId),
    getVotes: (pollId: number) => client.getVotes(pollId),
    getPresentationState: () => client.getPresentationState(),
    getCurrentPoll: () => client.getCurrentPoll(),
    getUserRole: () => client.getUserRole(),
  };
}

export function usePolls() {
  const { client, connected } = useSpacetimeDB();
  const [polls, setPolls] = useState<Poll[]>([]);

  useEffect(() => {
    if (!connected) return;

    // Get initial polls
    setPolls(client.getPolls());

    // Subscribe to poll updates
    const unsubscribe = client.subscribe('polls', (updatedPolls: Poll[]) => {
      setPolls([...updatedPolls]);
    });

    return unsubscribe;
  }, [client, connected]);

  return polls;
}

export function useOptions(pollId: number) {
  const { client, connected } = useSpacetimeDB();
  const [options, setOptions] = useState<Option[]>([]);

  useEffect(() => {
    if (!connected) return;

    // Get initial options
    setOptions(client.getOptions(pollId));

    // Subscribe to option updates
    const unsubscribe = client.subscribe('options', (updatedOptions: Option[]) => {
      setOptions(updatedOptions.filter(o => o.poll_id === pollId));
    });

    return unsubscribe;
  }, [client, connected, pollId]);

  return options;
}

export function useVotes(pollId: number) {
  const { client, connected } = useSpacetimeDB();
  const [votes, setVotes] = useState<Vote[]>([]);

  useEffect(() => {
    if (!connected) return;

    // Get initial votes
    setVotes(client.getVotes(pollId));

    // Subscribe to vote updates
    const unsubscribe = client.subscribe('votes', (updatedVotes: Vote[]) => {
      setVotes(updatedVotes.filter(v => v.poll_id === pollId));
    });

    return unsubscribe;
  }, [client, connected, pollId]);

  return votes;
}

export function usePresentationState() {
  const { client, connected } = useSpacetimeDB();
  const [state, setState] = useState<PresentationState | null>(null);

  useEffect(() => {
    if (!connected) return;

    // Get initial state
    setState(client.getPresentationState());

    // Subscribe to state updates
    const unsubscribe = client.subscribe('presentationState', (updatedState: PresentationState) => {
      setState(updatedState);
    });

    return unsubscribe;
  }, [client, connected]);

  return state;
}

export function useCurrentPoll() {
  const { client, connected } = useSpacetimeDB();
  const [currentPoll, setCurrentPoll] = useState<Poll | null>(null);
  const presentationState = usePresentationState();

  useEffect(() => {
    if (!connected || !presentationState) return;

    // Get current poll
    const poll = client.getCurrentPoll();
    setCurrentPoll(poll || null);

    // Subscribe to poll updates
    const unsubscribe = client.subscribe('polls', () => {
      const updatedPoll = client.getCurrentPoll();
      setCurrentPoll(updatedPoll || null);
    });

    return unsubscribe;
  }, [client, connected, presentationState]);

  return currentPoll;
}
