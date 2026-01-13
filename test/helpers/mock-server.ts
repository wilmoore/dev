import http from 'node:http';

export interface MockServer {
  url: string;
  port: number;
  close: () => Promise<void>;
  setResponse: (status: number, body: string) => void;
}

/**
 * Creates a mock HTTP server for health check testing
 */
export async function createMockServer(port = 0): Promise<MockServer> {
  let responseStatus = 200;
  let responseBody = 'OK';

  const server = http.createServer((req, res) => {
    res.statusCode = responseStatus;
    res.end(responseBody);
  });

  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to get server address'));
        return;
      }

      resolve({
        url: `http://127.0.0.1:${address.port}`,
        port: address.port,
        close: () =>
          new Promise(res => {
            server.close(() => res());
          }),
        setResponse: (status: number, body: string) => {
          responseStatus = status;
          responseBody = body;
        },
      });
    });

    server.on('error', reject);
  });
}
