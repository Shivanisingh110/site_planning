import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsing setup with generous limits to support Base64 file uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.text({ limit: '50mb', type: 'text/plain' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Static serving for local uploads directory
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // CORS-bypass proxy designed specifically for Google Apps Script Macros
  app.all('/api/proxy', async (req, res) => {
    let requestBody = req.body;
    if (typeof requestBody === 'string') {
      try {
        requestBody = JSON.parse(requestBody);
      } catch (e) {
        // Keep as string if not valid JSON
      }
    }

    const action = req.query.action || (requestBody && typeof requestBody === 'object' ? requestBody.action : undefined);
    
    // Direct resilient file upload flow (Attempt GAS Web App file upload first, fall back to local disk if failed)
    if (action === 'uploadFile') {
      const projectId = req.query.projectId || (requestBody && typeof requestBody === 'object' ? requestBody.projectId : 'GENERAL');
      const filename = req.query.filename || (requestBody && typeof requestBody === 'object' ? requestBody.filename : 'file.bin');
      const base64Data = requestBody && typeof requestBody === 'object' ? requestBody.base64 : undefined;

      console.log(`[Upload Proxy] Resilient uploadFile action started. Project: ${projectId}, Filename: ${filename}`);

      // 1. Attempt upload to Google Drive via Apps Script Web App
      try {
        const gasTargetUrl = new URL('https://script.google.com/macros/s/AKfycbwvBHaljaztP7eZaOukQ1m0HN4hh2wkmc_Ovfj5B4VOItWsmI5yDgRcQ0IWYaF3Cb9yMA/exec');
        gasTargetUrl.searchParams.set('action', 'uploadFile');

        console.log(`[Upload Proxy] Attempting direct Google Apps Script Drive upload...`);

        const response = await fetch(gasTargetUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody),
          redirect: 'follow',
        });

        if (response.ok) {
          const text = await response.text();
          if (text.trim() && !text.trim().startsWith('<')) {
            const json = JSON.parse(text);
            if (json && json.status === 'success') {
              console.log(`[Upload Proxy] GAS upload succeeded! Saved directly to Google Drive folder.`);
              res.json(json);
              return;
            } else {
              console.warn(`[Upload Proxy] GAS upload returned error status:`, json ? json.message : 'Unknown error');
            }
          } else {
            console.warn(`[Upload Proxy] GAS upload returned HTML redirect or login page instead of JSON response.`);
          }
        } else {
          console.warn(`[Upload Proxy] GAS upload failed on HTTP level: Status ${response.status}`);
        }
      } catch (gasError: any) {
        console.warn(`[Upload Proxy] GAS direct upload failed with error: ${gasError.message}. Initiating local disk storage fallback...`);
      }

      // 2. Local fallback if Google Apps Script Web App upload failed
      try {
        console.log(`[Upload Proxy Fallback] Initiating local disk storage fallback for ${filename}...`);
        if (!base64Data) {
          throw new Error("No base64 data provided in request body");
        }

        const fs = await import('fs');
        const fsPromises = fs.promises;

        // Define local uploads directory inside the workspace
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Clean filename to prevent path traversal
        const baseName = path.basename(filename as string).replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const safeFilename = `${Date.now()}_${baseName}`;
        const filePath = path.join(uploadsDir, safeFilename);

        // Write file from Base64
        const buffer = Buffer.from(base64Data as string, 'base64');
        await fsPromises.writeFile(filePath, buffer);

        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.get('host');
        
        let baseUrl = process.env.APP_URL;
        if (!baseUrl || baseUrl === 'MY_APP_URL') {
          baseUrl = `${protocol}://${host}`;
        } else {
          baseUrl = baseUrl.replace(/\/$/, "");
        }

        const fileUrl = `${baseUrl}/uploads/${safeFilename}`;
        console.log(`[Upload Proxy Fallback] File processed and saved locally: ${filePath}. Url: ${fileUrl}`);

        res.json({
          status: 'success',
          success: true,
          data: {
            name: filename,
            url: fileUrl,
            id: `local_${Date.now()}`,
          }
        });
        return;
      } catch (localErr: any) {
        console.error(`[Upload Proxy Error] Failed local write:`, localErr);
        res.status(500).json({
          status: 'error',
          message: `Both Google Apps Script and Local Fallback file upload failed: ${localErr.message}`,
        });
        return;
      }
    }
    
    // Exact URL of target Google Apps Script Web App
    const targetUrl = new URL('https://script.google.com/macros/s/AKfycbwvBHaljaztP7eZaOukQ1m0HN4hh2wkmc_Ovfj5B4VOItWsmI5yDgRcQ0IWYaF3Cb9yMA/exec');
    
    // Copy incoming query parameters to the target URL
    for (const [key, value] of Object.entries(req.query)) {
      targetUrl.searchParams.set(key, value as string);
    }

    // Ensure action is explicitly in searchParams
    if (action) {
      targetUrl.searchParams.set('action', action as string);
    }

    try {
      const method = req.method;
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain;charset=utf-8', // Preferred for Apps Script macros to prevent pre-flight complexity
      };

      const fetchOptions: any = {
        method,
        headers,
        redirect: 'follow', // Crucial to support Google Script's googleusercontent redirects
      };

      if (method === 'POST') {
        const payload = typeof requestBody === 'object' && requestBody !== null ? requestBody : req.body;
        fetchOptions.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
      }

      console.log(`[Proxy Request] Forwarding ${method} to: ${targetUrl.toString()}`);
      const response = await fetch(targetUrl.toString(), fetchOptions);

      console.log(`[Proxy Response] Status: ${response.status} ${response.statusText}`);
      console.log(`[Proxy Response] Headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        throw new Error(`Google Apps Script API proxy fetch error: HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      console.log(`[Proxy Response] Content-Type: ${contentType}`);

      const text = await response.text();
      // If we see HTML, let's print the first 500 chars to server logs
      if (contentType.includes('text/html') || text.trim().startsWith('<')) {
        console.log(`[Proxy Response] Warning: Received HTML instead of JSON. First 500 chars:`, text.substring(0, 500));
        
        res.status(400).json({
          status: 'error',
          message: 'Received HTML instead of JSON from Google Script. The Web App might have access restrictions (e.g. not published to "Anyone"), or it might be asking for Google Login.',
          htmlExcerpt: text.substring(0, 1000)
        });
        return;
      }

      try {
        const json = JSON.parse(text);
        res.json(json);
      } catch (parseErr) {
        console.log(`[Proxy Response] Failed to parse as JSON. Raw response:`, text.substring(0, 500));
        
        res.status(500).json({
          status: 'error',
          message: 'Response is not valid JSON',
          rawResponseExcerpt: text.substring(0, 1000)
        });
      }
    } catch (error: any) {
      console.error(`[Proxy Error] Action ${action || 'unknown'}:`, error);

      res.status(500).json({
        status: 'error',
        message: error.message || String(error),
      });
    }
  });

  // Integrate Vite integration depending on current environment mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server + Vite running on http://localhost:${PORT}`);
  });
}

startServer();
