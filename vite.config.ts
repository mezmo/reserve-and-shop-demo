import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

// Simple log writing plugin for development
const logWriterPlugin = () => ({
  name: 'log-writer',
  configureServer(server: any) {
    server.middlewares.use('/api/log-beacon', (req: any, res: any) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            // Simple parsing of multipart form data
            const parts = body.split('Content-Disposition: form-data;');
            const fileData = parts.find((part: string) => part.includes('name="logFile"'));
            
            if (fileData) {
              const content = fileData.split('\r\n\r\n')[1]?.split('\r\n--')[0];
              if (content) {
                const logFile = '/tmp/codeuser/restaurant-performance.log';
                
                // Ensure directory exists
                const logDir = path.dirname(logFile);
                if (!fs.existsSync(logDir)) {
                  fs.mkdirSync(logDir, { recursive: true });
                }
                
                // Append to log file
                fs.appendFileSync(logFile, content);
                console.log(`📝 Performance log written to ${logFile}`);
              }
            }
            
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
          } catch (error) {
            console.error('Error writing log:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error');
          }
        });
      } else {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
      }
    });
  }
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' && logWriterPlugin(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
