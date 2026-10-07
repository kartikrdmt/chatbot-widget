import { beforeEach, describe, expect, it, vi } from 'vitest';

type Ack = (error: Error | null, response?: unknown) => void;

/** A stand-in for the socket: it records what the transport does, and lets a test answer. */
const state = vi.hoisted(() => ({
  created: 0,
  options: undefined as { auth: (cb: (data: unknown) => void) => void } | undefined,
  socket: undefined as unknown as FakeSocket,
}));

interface FakeSocket {
  connected: boolean;
  emitted: { event: string; payload: unknown; ack?: Ack }[];
  timeouts: number[];
  disconnects: number;
  connects: number;
  on: (event: string, handler: (...args: unknown[]) => void) => FakeSocket;
  timeout: (ms: number) => { emit: (event: string, payload: unknown, ack?: Ack) => void };
  emit: (event: string, payload: unknown, ack?: Ack) => void;
  connect: () => FakeSocket;
  disconnect: () => FakeSocket;
}

vi.mock('socket.io-client', () => ({
  io: (_url: string, options: { auth: (cb: (data: unknown) => void) => void }) => {
    state.created += 1;
    state.options = options;
    const socket: FakeSocket = {
      connected: false,
      emitted: [],
      timeouts: [],
      disconnects: 0,
      connects: 0,
      on: () => socket,
      timeout: (ms) => ({
        emit: (event, payload, ack) => {
          socket.timeouts.push(ms);
          socket.emitted.push({ event, payload, ack });
        },
      }),
      emit: (event, payload, ack) => socket.emitted.push({ event, payload, ack }),
      connect: () => {
        socket.connects += 1;
        socket.connected = true;
        return socket;
      },
      disconnect: () => {
        socket.disconnects += 1;
        socket.connected = false;
        return socket;
      },
    };
    state.socket = socket;
    return socket;
  },
}));

import { SocketChatTransport } from './socket-chat-transport';

const presented = (): unknown => {
  let data: unknown;
  state.options?.auth((value) => (data = value));
  return data;
};

describe('SocketChatTransport and a renewed session', () => {
  beforeEach(() => {
    state.created = 0;
  });

  it('presents the newest token on every (re)connect', () => {
    const transport = new SocketChatTransport('first', 'http://api');
    expect(presented()).toEqual({ sessionToken: 'first' });
    transport.setSessionToken('second');
    expect(presented()).toEqual({ sessionToken: 'second' });
  });

  it('keeps the same connection and just tells the server about the new session', () => {
    const transport = new SocketChatTransport('first', 'http://api');
    transport.connect();

    transport.setSessionToken('second');

    expect(state.created).toBe(1);
    expect(state.socket.disconnects).toBe(0);
    expect(state.socket.emitted).toEqual([
      expect.objectContaining({ event: 'session:refresh', payload: { sessionToken: 'second' } }),
    ]);
  });

  it('does not reconnect when the server accepts the new session', () => {
    const transport = new SocketChatTransport('first', 'http://api');
    transport.connect();
    const connectsBefore = state.socket.connects;
    transport.setSessionToken('second');
    state.socket.emitted[0]?.ack?.(null, { ok: true });
    expect(state.socket.disconnects).toBe(0);
    expect(state.socket.connects).toBe(connectsBefore);
  });

  it.each([
    ['refuses it', null, { ok: false }],
    ['does not answer in time', new Error('timeout'), undefined],
  ])('reconnects with the new token when the server %s', (_name, error, response) => {
    const transport = new SocketChatTransport('first', 'http://api');
    transport.connect();
    transport.setSessionToken('second');
    state.socket.emitted[0]?.ack?.(error, response);
    expect(state.socket.disconnects).toBe(1);
    expect(state.socket.connects).toBe(2);
    expect(presented()).toEqual({ sessionToken: 'second' });
  });

  it('sends nothing while disconnected: the next connect uses the new token', () => {
    const transport = new SocketChatTransport('first', 'http://api');
    transport.setSessionToken('second');
    expect(state.socket.emitted).toEqual([]);
    expect(presented()).toEqual({ sessionToken: 'second' });
  });
});

describe('SocketChatTransport history', () => {
  it('asks with a 10 second timeout and starts with no messages if the server is silent', async () => {
    const transport = new SocketChatTransport('t', 'http://api');
    transport.connect();
    const history = transport.loadHistory();
    expect(state.socket.timeouts).toEqual([10_000]);
    state.socket.emitted[0]?.ack?.(new Error('operation has timed out'));
    expect(await history).toEqual([]);
  });

  it('returns the stored messages, ignoring any that are malformed', async () => {
    const transport = new SocketChatTransport('t', 'http://api');
    transport.connect();
    const history = transport.loadHistory();
    state.socket.emitted[0]?.ack?.(null, [
      { id: '1', sender: 'visitor', text: 'hi', createdAt: '2026-10-07T10:00:00.000Z' },
      { nope: true },
    ]);
    expect((await history).map((m) => m.text)).toEqual(['hi']);
  });
});
