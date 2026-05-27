import express from 'express';
import path from 'path';

const app = express();

// Body parsing setup with generous limits to support Base64 file uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb', type: 'text/plain' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
      console.warn(`[Upload Proxy] GAS direct upload failed with error: ${gasError.message}.`);
    }

    // 2. Note for Vercel Serverless environment:
    // Local ephemeral storage fallback was meant for persistent servers. In Serverless Vercel, 
    // files written to local disk are ephemeral and will clear when the instance powers down.
    // Instead of failing silently, let's inform that Drive sync is needed.
    res.status(400).json({
      status: 'error',
      message: 'Direct Vercel deployment requires correct Google Drive API script publishing. Local file storage is not supported in Serverless environments. Please verify your Google Apps Script Web App is published to "Anyone".',
    });
    return;
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

    if (!response.ok) {
      throw new Error(`Google Apps Script API proxy fetch error: HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    
    if (contentType.includes('text/html') || text.trim().startsWith('<')) {
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

export default app;
