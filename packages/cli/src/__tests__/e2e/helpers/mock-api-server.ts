// packages/cli/src/__tests__/e2e/helpers/mock-api-server.ts

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';

interface MockResponse {
  status?: number;
  body: unknown;
  headers?: Record<string, string>;
  stream?: boolean;
  streamChunks?: string[];
}

interface RequestLogEntry {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  timestamp: Date;
}

export class MockApiServer {
  private server: Server | null = null;
  private port = 0;
  private responseQueue: MockResponse[] = [];
  private requestLog: RequestLogEntry[] = [];

  async start(): Promise<{ port: number; baseUrl: string }> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));

      this.server.on('error', reject);

      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server!.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
          resolve({
            port: this.port,
            baseUrl: `http://127.0.0.1:${this.port}`,
          });
        } else {
          reject(new Error('Failed to get server address'));
        }
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        this.server = null;
        this.port = 0;
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  reset(): void {
    this.responseQueue = [];
    this.requestLog = [];
  }

  enqueueResponse(response: MockResponse): void {
    this.responseQueue.push(response);
  }

  getRequestLog(): RequestLogEntry[] {
    return [...this.requestLog];
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);

    let parsedBody: unknown;
    try {
      parsedBody = body ? JSON.parse(body) : null;
    } catch {
      parsedBody = body;
    }

    this.requestLog.push({
      method: req.method ?? 'UNKNOWN',
      path: req.url ?? '/',
      headers: { ...req.headers },
      body: parsedBody,
      timestamp: new Date(),
    });

    const mockResponse = this.responseQueue.shift();

    if (!mockResponse) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No mock responses queued' }));
      return;
    }

    const statusCode = mockResponse.status ?? 200;
    const extraHeaders = mockResponse.headers ?? {};

    if (mockResponse.stream && mockResponse.streamChunks) {
      res.writeHead(statusCode, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...extraHeaders,
      });

      for (const chunk of mockResponse.streamChunks) {
        res.write(`data: ${chunk}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        ...extraHeaders,
      });
      res.end(JSON.stringify(mockResponse.body));
    }
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      req.on('error', reject);
    });
  }
}
