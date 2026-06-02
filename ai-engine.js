/* ============================================================
 *  ai-engine.js — Multi-provider conversational AI for Oppie
 *  Vanilla browser JS (no modules). Globals are shared via
 *  <script defer> loading order. app.js supplies `state` and
 *  `googleUser`; this file exposes the functions below.
 * ============================================================ */

// Conversation memory (capped at 20 messages)
// Each entry: { role: 'user' | 'assistant', content: string }
var conversationHistory = [];

/* ----------------------------------------------------------
 *  1. buildSystemPrompt(state, googleUser)
 *  Assembles the system-level instruction string that tells
 *  every provider who Oppie is, what it can do, and how to
 *  behave.
 * ---------------------------------------------------------- */
function buildSystemPrompt(state, googleUser) {
  var connectedServices = [];
  if (state && state.connectors) {
    Object.keys(state.connectors).forEach(function (key) {
      var c = state.connectors[key];
      if (c && (c.connected || c.status === 'Connected')) {
        connectedServices.push(c.name || key);
      }
    });
  }

  var mcpList = [];
  if (state && state.mcps) {
    Object.keys(state.mcps).forEach(function (key) {
      var m = state.mcps[key];
      if (m && (m.connected || m.status === 'Active' || m.status === 'Connected')) {
        mcpList.push(m.name || key);
      }
    });
  }

  var userName = 'the user';
  var userEmail = '';
  if (googleUser) {
    if (googleUser.name) userName = googleUser.name;
    if (googleUser.given_name) userName = googleUser.given_name;
    if (googleUser.email) userEmail = googleUser.email;
  } else if (state && state.user) {
    if (state.user.name) userName = state.user.name;
    if (state.user.email) userEmail = state.user.email;
  }

  var prompt =
    'You are **Oppie** — an autonomous background agent that monitors and automates tasks for ' +
    userName +
    '.\n\n' +
    '## Identity\n' +
    '- You run **persistently** inside a browser tab, watching for events, processing data, and taking action on behalf of the user.\n' +
    '- You are NOT a generic chatbot. You are a specialised background worker with direct access to Google services.\n\n' +
    '## Connected Google Services\n';

  if (connectedServices.length > 0) {
    connectedServices.forEach(function (svc) {
      prompt += '- ' + svc + '\n';
    });
  } else {
    prompt += '- (no services connected yet)\n';
  }

  if (mcpList.length > 0) {
    prompt += '\n## Connected MCP Servers\n';
    mcpList.forEach(function (m) {
      prompt += '- ' + m + '\n';
    });
  }

  prompt += '\n## User\n';
  prompt += '- Name: ' + userName + '\n';
  if (userEmail) {
    prompt += '- Email: ' + userEmail + '\n';
  }

  prompt +=
    '\n## Capabilities\n' +
    '- **Gmail**: Monitor inbox, read and summarise emails, flag important messages\n' +
    '- **Calendar**: Create, update, and query calendar events and schedules\n' +
    '- **Drive**: Browse, search, and organise files in Google Drive\n' +
    '- **Sheets**: Read and analyse spreadsheet data\n' +
    '- **Slides**: View and summarise presentation content\n' +
    '- **Tasks**: Create, complete, and manage task lists\n' +
    '- **Maps**: Show locations, get directions, and display points of interest\n\n' +
    '## Instructions\n' +
    '- Be conversational, concise, and friendly.\n' +
    '- **Distinguish between Immediate Queries and Background Monitoring**:\n' +
    '  - **Immediate Queries**: If the user asks to check, retrieve, search, create, update, or run something *now* (e.g., "Check my email for X", "What is on my calendar", "Create a doc named Y"), **execute the tools immediately** to get the data/perform the action, and reply with the final results right away in the response. Do NOT create or describe a background daemon for immediate queries.\n' +
    '  - **Background Monitoring**: If the user asks you to watch, monitor, track, or automate something continuously over time (e.g., "Keep an eye out for X", "Monitor my emails for Y", "Check every hour if Z"), **then** describe the background daemon you would spin up, what triggers / cadence it would use, and how it will alert them when conditions are met.\n' +
    '- Reference Google services by their proper names (Gmail, Google Calendar, etc.).\n' +
    '- Use **Markdown** formatting in your replies (headings, bold, lists, code blocks when useful).\n' +
    "- Don't be robotic or overly formal — you're a helpful assistant.\n" +
    '- Remember: you are a **specialised worker** with tool-calling capabilities to access Google Workspace.\n';

  if (state && state.ai && state.ai.customInstructions) {
    prompt += '\n## Custom Instructions from User\n' + state.ai.customInstructions + '\n';
  }

  return prompt;
}

/* ----------------------------------------------------------
 *  2. Tool Definitions & Executers
 * ---------------------------------------------------------- */
var lastUsedServices = [];

var oppieTools = [
  {
    name: 'fetchRecentEmails',
    description: "Fetch recent email messages from the user's Gmail inbox. Supports filtering via query and limiting max results.",
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Gmail search query, e.g. "is:unread" or "from:someone"' },
        maxResults: { type: 'INTEGER', description: 'Maximum number of emails to retrieve (default 5)' }
      }
    }
  },
  {
    name: 'sendGmail',
    description: 'Send an email message to a specified recipient via Gmail.',
    parameters: {
      type: 'OBJECT',
      properties: {
        to: { type: 'STRING', description: 'Recipient\'s email address (required)' },
        subject: { type: 'STRING', description: 'Subject line (required)' },
        body: { type: 'STRING', description: 'Body content of the email (required)' }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'fetchCalendarEvents',
    description: 'Fetch upcoming events from the user\'s primary Google Calendar starting from current time.',
    parameters: {
      type: 'OBJECT',
      properties: {
        maxResults: { type: 'INTEGER', description: 'Maximum number of events to return (default 5)' }
      }
    }
  },
  {
    name: 'createCalendarEvent',
    description: 'Create a new event on the user\'s primary Google Calendar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        summary: { type: 'STRING', description: 'Event title (required)' },
        startTime: { type: 'STRING', description: 'ISO 8601 datetime string for start time, e.g. "2026-06-03T10:00:00Z" (required)' },
        endTime: { type: 'STRING', description: 'ISO 8601 datetime string for end time, e.g. "2026-06-03T11:00:00Z" (required)' },
        description: { type: 'STRING', description: 'Description of the event (optional)' }
      },
      required: ['summary', 'startTime', 'endTime']
    }
  },
  {
    name: 'fetchDriveFiles',
    description: 'List files from the user\'s Google Drive, ordered by most recently modified.',
    parameters: {
      type: 'OBJECT',
      properties: {
        maxResults: { type: 'INTEGER', description: 'Maximum number of files to return (default 10)' }
      }
    }
  },
  {
    name: 'fetchTasks',
    description: 'Fetch tasks from the user\'s Google Tasks list.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'fetchSpreadsheetData',
    description: 'Fetch values from a specific Google Spreadsheet range.',
    parameters: {
      type: 'OBJECT',
      properties: {
        spreadsheetId: { type: 'STRING', description: 'The ID of the spreadsheet (required)' },
        range: { type: 'STRING', description: 'Sheet and range, e.g. "Sheet1!A1:D10" (required)' }
      },
      required: ['spreadsheetId', 'range']
    }
  },
  {
    name: 'createSpreadsheet',
    description: 'Create a new Google Spreadsheet with the given title.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'The title of the new spreadsheet (required)' }
      },
      required: ['title']
    }
  },
  {
    name: 'updateSpreadsheetData',
    description: 'Write or update cell values in a Google Sheet range.',
    parameters: {
      type: 'OBJECT',
      properties: {
        spreadsheetId: { type: 'STRING', description: 'The ID of the spreadsheet (required)' },
        range: { type: 'STRING', description: 'Sheet and range, e.g. "Sheet1!A1:B2" (required)' },
        values: {
          type: 'ARRAY',
          items: {
            type: 'ARRAY',
            items: { type: 'STRING' }
          },
          description: '2D array of cells to write, e.g. [["val1", "val2"]] (required)'
        }
      },
      required: ['spreadsheetId', 'range', 'values']
    }
  },
  {
    name: 'fetchPresentationData',
    description: 'Fetch a Google Slides presentation resource structure.',
    parameters: {
      type: 'OBJECT',
      properties: {
        presentationId: { type: 'STRING', description: 'The ID of the presentation (required)' }
      },
      required: ['presentationId']
    }
  },
  {
    name: 'createPresentation',
    description: 'Create a new Google Slides presentation.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'The title of the new presentation (required)' }
      },
      required: ['title']
    }
  },
  {
    name: 'updatePresentation',
    description: 'Send batch update requests to modify a Google Slides presentation.',
    parameters: {
      type: 'OBJECT',
      properties: {
        presentationId: { type: 'STRING', description: 'The ID of the presentation (required)' },
        requests: {
          type: 'ARRAY',
          items: { type: 'OBJECT', description: 'Presentation update request object' },
          description: 'Array of presentation update request objects (required)'
        }
      },
      required: ['presentationId', 'requests']
    }
  },
  {
    name: 'fetchDocumentData',
    description: 'Retrieve text content and structural elements of a Google Document.',
    parameters: {
      type: 'OBJECT',
      properties: {
        documentId: { type: 'STRING', description: 'The ID of the document (required)' }
      },
      required: ['documentId']
    }
  },
  {
    name: 'createDocument',
    description: 'Create a new Google Document.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'The title of the document (required)' }
      },
      required: ['title']
    }
  },
  {
    name: 'updateDocument',
    description: 'Send batch update commands to insert or delete text in a Google Document.',
    parameters: {
      type: 'OBJECT',
      properties: {
        documentId: { type: 'STRING', description: 'The ID of the document (required)' },
        requests: {
          type: 'ARRAY',
          items: { type: 'OBJECT', description: 'Docs update request object' },
          description: 'Array of Docs update request objects (required)'
        }
      },
      required: ['documentId', 'requests']
    }
  },
  {
    name: 'fetchFormData',
    description: 'Retrieve Google Form questions and settings.',
    parameters: {
      type: 'OBJECT',
      properties: {
        formId: { type: 'STRING', description: 'The ID of the form (required)' }
      },
      required: ['formId']
    }
  },
  {
    name: 'fetchFormResponses',
    description: 'Retrieve survey responses submitted to a Google Form.',
    parameters: {
      type: 'OBJECT',
      properties: {
        formId: { type: 'STRING', description: 'The ID of the form (required)' }
      },
      required: ['formId']
    }
  },
  {
    name: 'createForm',
    description: 'Create a new Google Form with the given title.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'The title of the new form (required)' }
      },
      required: ['title']
    }
  },
  {
    name: 'readDriveFileContent',
    description: 'Read the text content of a file in Google Drive, automatically exporting workspace assets (Docs/Sheets) to plain text.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fileId: { type: 'STRING', description: 'The ID of the file (required)' },
        mimeType: { type: 'STRING', description: 'Optional mime type of the file' }
      },
      required: ['fileId']
    }
  },
  {
    name: 'createDriveFile',
    description: 'Create or upload a file containing plain text or data into Google Drive.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Name of the file (required)' },
        mimeType: { type: 'STRING', description: 'Mime type of the file (required)' },
        content: { type: 'STRING', description: 'Plain text content of the file' }
      },
      required: ['name', 'mimeType']
    }
  },
  {
    name: 'getDirections',
    description: 'Query routes, distances, and travel times from Google Maps directions service.',
    parameters: {
      type: 'OBJECT',
      properties: {
        origin: { type: 'STRING', description: 'Starting address/coordinates (required)' },
        destination: { type: 'STRING', description: 'Ending address/coordinates (required)' },
        travelMode: { type: 'STRING', description: 'Travel mode: driving, walking, bicycling, or transit' }
      },
      required: ['origin', 'destination']
    }
  },
  {
    name: 'searchPlaces',
    description: 'Look up places, points of interest, or business details using Google Places text search.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Place search text, e.g. "pizza near Boston" (required)' }
      },
      required: ['query']
    }
  }
];

async function executeTool(name, args) {
  console.log(`[ai-engine] Executing tool ${name} with args:`, args);
  
  // Track service access
  if (name.includes('Email') || name.includes('Gmail')) {
    if (!lastUsedServices.includes('gmail')) lastUsedServices.push('gmail');
  } else if (name.includes('Calendar')) {
    if (!lastUsedServices.includes('calendar')) lastUsedServices.push('calendar');
  } else if (name.includes('Document') || name.includes('Doc')) {
    if (!lastUsedServices.includes('drive')) lastUsedServices.push('drive');
  } else if (name.includes('Drive') || name.includes('File')) {
    if (!lastUsedServices.includes('drive')) lastUsedServices.push('drive');
  } else if (name.includes('Tasks')) {
    if (!lastUsedServices.includes('tasks')) lastUsedServices.push('tasks');
  } else if (name.includes('Spreadsheet') || name.includes('Sheet')) {
    if (!lastUsedServices.includes('sheets')) lastUsedServices.push('sheets');
  } else if (name.includes('Presentation') || name.includes('Slide')) {
    if (!lastUsedServices.includes('slides')) lastUsedServices.push('slides');
  } else if (name.includes('Form')) {
    if (!lastUsedServices.includes('forms')) lastUsedServices.push('forms');
  } else if (name.includes('Directions') || name.includes('Places') || name.includes('Map')) {
    if (!lastUsedServices.includes('maps')) lastUsedServices.push('maps');
  }

  // Execute actual function from google-auth.js
  try {
    switch (name) {
      case 'fetchRecentEmails':
        var query = args.query || '';
        var maxResults = args.maxResults !== undefined ? Number(args.maxResults) : 5;
        if (typeof fetchRecentEmails !== 'function') throw new Error('fetchRecentEmails API function is not loaded');
        var emails = await fetchRecentEmails(query, maxResults);
        return { success: true, data: emails };
      case 'sendGmail':
        if (typeof sendGmail !== 'function') throw new Error('sendGmail API function is not loaded');
        var resGmail = await sendGmail(args.to, args.subject, args.body);
        return { success: true, data: resGmail };
      case 'fetchCalendarEvents':
        var maxResCal = args.maxResults !== undefined ? Number(args.maxResults) : 5;
        if (typeof fetchCalendarEvents !== 'function') throw new Error('fetchCalendarEvents API function is not loaded');
        var events = await fetchCalendarEvents(maxResCal);
        return { success: true, data: events };
      case 'createCalendarEvent':
        if (typeof createCalendarEvent !== 'function') throw new Error('createCalendarEvent API function is not loaded');
        var resCal = await createCalendarEvent(args.summary, args.startTime, args.endTime, args.description);
        return { success: true, data: resCal };
      case 'fetchDriveFiles':
        var maxResDrv = args.maxResults !== undefined ? Number(args.maxResults) : 10;
        if (typeof fetchDriveFiles !== 'function') throw new Error('fetchDriveFiles API function is not loaded');
        var files = await fetchDriveFiles(maxResDrv);
        return { success: true, data: files };
      case 'fetchTasks':
        if (typeof fetchTasks !== 'function') throw new Error('fetchTasks API function is not loaded');
        var tasks = await fetchTasks();
        return { success: true, data: tasks };
      case 'fetchSpreadsheetData':
        if (typeof fetchSpreadsheetData !== 'function') throw new Error('fetchSpreadsheetData API function is not loaded');
        var sheetVal = await fetchSpreadsheetData(args.spreadsheetId, args.range);
        return { success: true, data: sheetVal };
      case 'createSpreadsheet':
        if (typeof createSpreadsheet !== 'function') throw new Error('createSpreadsheet API function is not loaded');
        var newSheet = await createSpreadsheet(args.title);
        return { success: true, data: newSheet };
      case 'updateSpreadsheetData':
        if (typeof updateSpreadsheetData !== 'function') throw new Error('updateSpreadsheetData API function is not loaded');
        var resSheet = await updateSpreadsheetData(args.spreadsheetId, args.range, args.values);
        return { success: true, data: resSheet };
      case 'fetchPresentationData':
        if (typeof fetchPresentationData !== 'function') throw new Error('fetchPresentationData API function is not loaded');
        var presData = await fetchPresentationData(args.presentationId);
        return { success: true, data: presData };
      case 'createPresentation':
        if (typeof createPresentation !== 'function') throw new Error('createPresentation API function is not loaded');
        var newPres = await createPresentation(args.title);
        return { success: true, data: newPres };
      case 'updatePresentation':
        if (typeof updatePresentation !== 'function') throw new Error('updatePresentation API function is not loaded');
        var resPres = await updatePresentation(args.presentationId, args.requests);
        return { success: true, data: resPres };
      case 'fetchDocumentData':
        if (typeof fetchDocumentData !== 'function') throw new Error('fetchDocumentData API function is not loaded');
        var docData = await fetchDocumentData(args.documentId);
        return { success: true, data: docData };
      case 'createDocument':
        if (typeof createDocument !== 'function') throw new Error('createDocument API function is not loaded');
        var newDoc = await createDocument(args.title);
        return { success: true, data: newDoc };
      case 'updateDocument':
        if (typeof updateDocument !== 'function') throw new Error('updateDocument API function is not loaded');
        var resDoc = await updateDocument(args.documentId, args.requests);
        return { success: true, data: resDoc };
      case 'fetchFormData':
        if (typeof fetchFormData !== 'function') throw new Error('fetchFormData API function is not loaded');
        var formData = await fetchFormData(args.formId);
        return { success: true, data: formData };
      case 'fetchFormResponses':
        if (typeof fetchFormResponses !== 'function') throw new Error('fetchFormResponses API function is not loaded');
        var formResp = await fetchFormResponses(args.formId);
        return { success: true, data: formResp };
      case 'createForm':
        if (typeof createForm !== 'function') throw new Error('createForm API function is not loaded');
        var newForm = await createForm(args.title);
        return { success: true, data: newForm };
      case 'readDriveFileContent':
        if (typeof readDriveFileContent !== 'function') throw new Error('readDriveFileContent API function is not loaded');
        var fileContent = await readDriveFileContent(args.fileId, args.mimeType);
        return { success: true, data: fileContent };
      case 'createDriveFile':
        if (typeof createDriveFile !== 'function') throw new Error('createDriveFile API function is not loaded');
        var newFile = await createDriveFile(args.name, args.mimeType, args.content);
        return { success: true, data: newFile };
      case 'getDirections':
        if (typeof getDirections !== 'function') throw new Error('getDirections API function is not loaded');
        var dirs = await getDirections(args.origin, args.destination, args.travelMode);
        return { success: true, data: dirs };
      case 'searchPlaces':
        if (typeof searchPlaces !== 'function') throw new Error('searchPlaces API function is not loaded');
        var places = await searchPlaces(args.query);
        return { success: true, data: places };
      default:
        throw new Error(`Unknown tool name: ${name}`);
    }
  } catch (e) {
    console.error(`[ai-engine] Error running tool ${name}:`, e);
    return { success: false, error: e.message || String(e) };
  }
}

/* ----------------------------------------------------------
 *  3. Parameter Casing & History Translators
 * ---------------------------------------------------------- */
function transformSchemaTypes(schema, toUpper) {
  if (!schema || typeof schema !== 'object') return;
  if (schema.type && typeof schema.type === 'string') {
    schema.type = toUpper ? schema.type.toUpperCase() : schema.type.toLowerCase();
  }
  if (schema.properties) {
    Object.keys(schema.properties).forEach(function (k) {
      transformSchemaTypes(schema.properties[k], toUpper);
    });
  }
  if (schema.items) {
    transformSchemaTypes(schema.items, toUpper);
  }
}

function translateHistoryToGemini(history) {
  var contents = [];
  history.forEach(function (msg) {
    if (msg.role === 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: msg.content }]
      });
    } else if (msg.role === 'assistant') {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        var parts = msg.tool_calls.map(function (tc) {
          return {
            functionCall: {
              name: tc.name,
              args: tc.args
            }
          };
        });
        contents.push({
          role: 'model',
          parts: parts
        });
      } else {
        contents.push({
          role: 'model',
          parts: [{ text: msg.content || '' }]
        });
      }
    } else if (msg.role === 'tool') {
      var parts = msg.tool_responses.map(function (tr) {
        return {
          functionResponse: {
            name: tr.name,
            response: tr.response
          }
        };
      });
      contents.push({
        role: 'user',
        parts: parts
      });
    }
  });
  return contents;
}

function translateHistoryToOpenAI(history) {
  var messages = [];
  history.forEach(function (msg) {
    if (msg.role === 'user') {
      messages.push({
        role: 'user',
        content: msg.content
      });
    } else if (msg.role === 'assistant') {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        var toolCalls = msg.tool_calls.map(function (tc) {
          return {
            id: tc.id || `call_${Math.random().toString(36).substring(7)}`,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.args)
            }
          };
        });
        messages.push({
          role: 'assistant',
          tool_calls: toolCalls
        });
      } else {
        messages.push({
          role: 'assistant',
          content: msg.content || ''
        });
      }
    } else if (msg.role === 'tool') {
      msg.tool_responses.forEach(function (tr) {
        messages.push({
          role: 'tool',
          tool_call_id: tr.id || `call_${Math.random().toString(36).substring(7)}`,
          name: tr.name,
          content: typeof tr.response === 'string' ? tr.response : JSON.stringify(tr.response)
        });
      });
    }
  });
  return messages;
}

function translateHistoryToClaude(history) {
  var messages = [];
  history.forEach(function (msg) {
    if (msg.role === 'user') {
      messages.push({
        role: 'user',
        content: msg.content
      });
    } else if (msg.role === 'assistant') {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        var content = [];
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        msg.tool_calls.forEach(function (tc) {
          content.push({
            type: 'tool_use',
            id: tc.id || `toolu_${Math.random().toString(36).substring(7)}`,
            name: tc.name,
            input: tc.args
          });
        });
        messages.push({
          role: 'assistant',
          content: content
        });
      } else {
        messages.push({
          role: 'assistant',
          content: msg.content || ''
        });
      }
    } else if (msg.role === 'tool') {
      var content = msg.tool_responses.map(function (tr) {
        return {
          type: 'tool_result',
          tool_use_id: tr.id || `toolu_${Math.random().toString(36).substring(7)}`,
          content: typeof tr.response === 'string' ? tr.response : JSON.stringify(tr.response)
        };
      });
      messages.push({
        role: 'user',
        content: content
      });
    }
  });
  return messages;
}

/* ----------------------------------------------------------
 *  4. callAI(provider, model, apiKey, userMessage)
 *  Entry point for every chat turn. Manages history, routes
 *  to the right provider, and falls back to demo mode when
 *  there is no API key.
 * ---------------------------------------------------------- */
async function callAI(provider, model, apiKey, userMessage) {
  // Reset the tracked services for this conversational turn
  lastUsedServices = [];

  // Append the user turn
  conversationHistory.push({ role: 'user', content: userMessage });

  // Cap history at 20 messages (keep most recent)
  if (conversationHistory.length > 20) {
    conversationHistory = conversationHistory.slice(conversationHistory.length - 20);
  }

  // No key → demo mode
  if (!apiKey) {
    return generateDemoResponse(userMessage);
  }

  try {
    switch (provider) {
      case 'gemini':
        return await callGemini(apiKey, model, conversationHistory);
      case 'openai':
        return await callOpenAI(apiKey, model, conversationHistory);
      case 'claude':
        return await callClaude(apiKey, model, conversationHistory);
      case 'openrouter':
        return await callOpenRouter(apiKey, model, conversationHistory);
      default:
        return 'Unknown AI provider: **' + provider + '**. Supported providers are Gemini, OpenAI, Claude, and OpenRouter.';
    }
  } catch (err) {
    console.error('[ai-engine] callAI error:', err);
    return '⚠️ AI request failed: ' + (err.message || String(err));
  }
}

/* ----------------------------------------------------------
 *  5. callGemini(apiKey, model, messages)
 * ---------------------------------------------------------- */
async function callGemini(apiKey, model, messages) {
  var url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) +
    ':generateContent?key=' +
    encodeURIComponent(apiKey);

  // Build system instruction
  var systemPrompt = buildSystemPrompt(
    typeof state !== 'undefined' ? state : {},
    typeof googleUser !== 'undefined' ? googleUser : null
  );

  // Translate tools to Gemini's format:
  // Convert our parameter types to uppercase
  var geminiTools = oppieTools.map(function (t) {
    var params = JSON.parse(JSON.stringify(t.parameters));
    transformSchemaTypes(params, true);
    return {
      name: t.name,
      description: t.description,
      parameters: params
    };
  });

  var loopCount = 0;
  while (loopCount < 5) {
    loopCount++;
    var contents = translateHistoryToGemini(messages);

    var body = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: contents,
      tools: [{ functionDeclarations: geminiTools }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    };

    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      var errBody = await res.text();
      throw new Error('Gemini API ' + res.status + ': ' + errBody);
    }

    var data = await res.json();

    if (data.error) {
      throw new Error('Gemini API Error: ' + data.error.message + ' (Code: ' + data.error.code + ')');
    }

    if (data.promptFeedback && data.promptFeedback.blockReason) {
      throw new Error('Gemini blocked the prompt. Reason: ' + data.promptFeedback.blockReason + '. Details: ' + JSON.stringify(data.promptFeedback));
    }

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('Gemini returned a response with no candidates: ' + JSON.stringify(data));
    }

    var candidate = data.candidates[0];
    if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
      throw new Error('Gemini failed to generate response. Finish Reason: ' + candidate.finishReason + '. Details: ' + JSON.stringify(candidate));
    }

    if (!candidate.content || !candidate.content.parts) {
      throw new Error('Gemini response candidate does not contain content parts. JSON: ' + JSON.stringify(data));
    }

    var content = candidate.content;
    var parts = content.parts;

    // Check if the model wants to call tools
    var toolCalls = [];
    parts.forEach(function (part) {
      if (part.functionCall) {
        toolCalls.push({
          name: part.functionCall.name,
          args: part.functionCall.args || {}
        });
      }
    });

    if (toolCalls.length > 0) {
      // Add tool calls to history
      var toolCallMsg = { role: 'assistant', tool_calls: toolCalls };
      messages.push(toolCallMsg);
      if (messages !== conversationHistory) {
        conversationHistory.push(toolCallMsg);
      }

      // Execute tool calls
      var toolResponses = [];
      for (var i = 0; i < toolCalls.length; i++) {
        var tc = toolCalls[i];
        if (typeof addLog === 'function') {
          addLog('info', `Executing tool: ${tc.name}...`);
        }
        var toolResult = await executeTool(tc.name, tc.args);
        
        toolResponses.push({
          name: tc.name,
          response: toolResult
        });
      }

      // Add tool responses to history
      var toolRespMsg = { role: 'tool', tool_responses: toolResponses };
      messages.push(toolRespMsg);
      if (messages !== conversationHistory) {
        conversationHistory.push(toolRespMsg);
      }

      // Continue loop
      continue;
    } else {
      // It's a text response
      var text = parts[0].text || '';
      var assistantMsg = { role: 'assistant', content: text };
      var alreadyPushed = false;
      if (messages.length > 0) {
        var last = messages[messages.length - 1];
        if (last.role === 'assistant' && last.content === text) {
          alreadyPushed = true;
        }
      }
      if (!alreadyPushed) {
        messages.push(assistantMsg);
        if (messages !== conversationHistory) {
          conversationHistory.push(assistantMsg);
        }
      }
      return text;
    }
  }
  throw new Error('Too many tool calling iterations (max 5).');
}

/* ----------------------------------------------------------
 *  6. callOpenAI(apiKey, model, messages)
 * ---------------------------------------------------------- */
async function callOpenAI(apiKey, model, messages) {
  var systemPrompt = buildSystemPrompt(
    typeof state !== 'undefined' ? state : {},
    typeof googleUser !== 'undefined' ? googleUser : null
  );

  // Tools in OpenAI format (parameters in lowercase)
  var openAiTools = oppieTools.map(function (t) {
    var params = JSON.parse(JSON.stringify(t.parameters));
    transformSchemaTypes(params, false);
    return {
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: params
      }
    };
  });

  var loopCount = 0;
  while (loopCount < 5) {
    loopCount++;
    var apiMessages = [{ role: 'system', content: systemPrompt }];
    var translated = translateHistoryToOpenAI(messages);
    apiMessages = apiMessages.concat(translated);

    var res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
      },
      body: JSON.stringify((function () {
        var reqBody = {
          model: model,
          messages: apiMessages,
          tools: openAiTools,
          max_completion_tokens: 1024
        };
        var isReasoning = /(^|[-/])o[0-9]+\b/.test(model);
        if (!isReasoning) {
          reqBody.temperature = 0.7;
        }
        return reqBody;
      })()),
    });

    if (!res.ok) {
      var errBody = await res.text();
      throw new Error('OpenAI API ' + res.status + ': ' + errBody);
    }

    var data = await res.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('OpenAI returned an unexpected response structure.');
    }

    var msg = data.choices[0].message;

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      // AI wants to call tools
      var toolCalls = msg.tool_calls.map(function (tc) {
        var args = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch (e) {
          console.error('[ai-engine] Failed to parse OpenAI arguments:', e);
        }
        return {
          id: tc.id,
          name: tc.function.name,
          args: args
        };
      });

      var toolCallMsg = { role: 'assistant', tool_calls: toolCalls };
      messages.push(toolCallMsg);
      if (messages !== conversationHistory) {
        conversationHistory.push(toolCallMsg);
      }

      var toolResponses = [];
      for (var i = 0; i < toolCalls.length; i++) {
        var tc = toolCalls[i];
        if (typeof addLog === 'function') {
          addLog('info', `Executing tool: ${tc.name}...`);
        }
        var toolResult = await executeTool(tc.name, tc.args);
        toolResponses.push({
          id: tc.id,
          name: tc.name,
          response: toolResult
        });
      }

      var toolRespMsg = { role: 'tool', tool_responses: toolResponses };
      messages.push(toolRespMsg);
      if (messages !== conversationHistory) {
        conversationHistory.push(toolRespMsg);
      }

      continue;
    } else {
      var text = msg.content || '';
      var assistantMsg = { role: 'assistant', content: text };
      var alreadyPushed = false;
      if (messages.length > 0) {
        var last = messages[messages.length - 1];
        if (last.role === 'assistant' && last.content === text) {
          alreadyPushed = true;
        }
      }
      if (!alreadyPushed) {
        messages.push(assistantMsg);
        if (messages !== conversationHistory) {
          conversationHistory.push(assistantMsg);
        }
      }
      return text;
    }
  }
  throw new Error('Too many tool calling iterations (max 5).');
}

/* ----------------------------------------------------------
 *  7. callClaude(apiKey, model, messages)
 * ---------------------------------------------------------- */
async function callClaude(apiKey, model, messages) {
  var systemPrompt = buildSystemPrompt(
    typeof state !== 'undefined' ? state : {},
    typeof googleUser !== 'undefined' ? googleUser : null
  );

  // Tools in Claude format (parameters in lowercase)
  var claudeTools = oppieTools.map(function (t) {
    var params = JSON.parse(JSON.stringify(t.parameters));
    transformSchemaTypes(params, false);
    return {
      name: t.name,
      description: t.description,
      input_schema: params
    };
  });

  var loopCount = 0;
  while (loopCount < 5) {
    loopCount++;
    var apiMessages = translateHistoryToClaude(messages);

    var res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model,
        system: systemPrompt,
        messages: apiMessages,
        tools: claudeTools,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      var errBody = await res.text();
      throw new Error('Claude API ' + res.status + ': ' + errBody);
    }

    var data = await res.json();

    if (!data.content) {
      throw new Error('Claude returned an unexpected response structure.');
    }

    // Check content parts for tool_use blocks
    var toolCalls = [];
    var textParts = [];
    data.content.forEach(function (part) {
      if (part.type === 'tool_use') {
        toolCalls.push({
          id: part.id,
          name: part.name,
          args: part.input || {}
        });
      } else if (part.type === 'text') {
        textParts.push(part.text);
      }
    });

    var responseText = textParts.join('\n');

    if (toolCalls.length > 0) {
      var toolCallMsg = { role: 'assistant', content: responseText, tool_calls: toolCalls };
      messages.push(toolCallMsg);
      if (messages !== conversationHistory) {
        conversationHistory.push(toolCallMsg);
      }

      var toolResponses = [];
      for (var i = 0; i < toolCalls.length; i++) {
        var tc = toolCalls[i];
        if (typeof addLog === 'function') {
          addLog('info', `Executing tool: ${tc.name}...`);
        }
        var toolResult = await executeTool(tc.name, tc.args);
        toolResponses.push({
          id: tc.id,
          name: tc.name,
          response: toolResult
        });
      }

      var toolRespMsg = { role: 'tool', tool_responses: toolResponses };
      messages.push(toolRespMsg);
      if (messages !== conversationHistory) {
        conversationHistory.push(toolRespMsg);
      }

      continue;
    } else {
      var assistantMsg = { role: 'assistant', content: responseText };
      var alreadyPushed = false;
      if (messages.length > 0) {
        var last = messages[messages.length - 1];
        if (last.role === 'assistant' && last.content === responseText) {
          alreadyPushed = true;
        }
      }
      if (!alreadyPushed) {
        messages.push(assistantMsg);
        if (messages !== conversationHistory) {
          conversationHistory.push(assistantMsg);
        }
      }
      return responseText;
    }
  }
  throw new Error('Too many tool calling iterations (max 5).');
}

/* ----------------------------------------------------------
 *  8. callOpenRouter(apiKey, model, messages)
 * ---------------------------------------------------------- */
async function callOpenRouter(apiKey, model, messages) {
  var systemPrompt = buildSystemPrompt(
    typeof state !== 'undefined' ? state : {},
    typeof googleUser !== 'undefined' ? googleUser : null
  );

  // Tools in OpenAI format for OpenRouter
  var openAiTools = oppieTools.map(function (t) {
    var params = JSON.parse(JSON.stringify(t.parameters));
    transformSchemaTypes(params, false);
    return {
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: params
      }
    };
  });

  var loopCount = 0;
  while (loopCount < 5) {
    loopCount++;
    var apiMessages = [{ role: 'system', content: systemPrompt }];
    var translated = translateHistoryToOpenAI(messages);
    apiMessages = apiMessages.concat(translated);

    var res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Oppie Agent',
      },
      body: JSON.stringify((function () {
        var reqBody = {
          model: model,
          messages: apiMessages,
          tools: openAiTools,
          max_completion_tokens: 1024
        };
        var isReasoning = /(^|[-/])o[0-9]+\b/.test(model);
        if (!isReasoning) {
          reqBody.temperature = 0.7;
        }
        return reqBody;
      })()),
    });

    if (!res.ok) {
      var errBody = await res.text();
      throw new Error('OpenRouter API ' + res.status + ': ' + errBody);
    }

    var data = await res.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('OpenRouter returned an unexpected response structure.');
    }

    var msg = data.choices[0].message;

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      // AI wants to call tools
      var toolCalls = msg.tool_calls.map(function (tc) {
        var args = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch (e) {
          console.error('[ai-engine] Failed to parse OpenRouter arguments:', e);
        }
        return {
          id: tc.id,
          name: tc.function.name,
          args: args
        };
      });

      var toolCallMsg = { role: 'assistant', tool_calls: toolCalls };
      messages.push(toolCallMsg);
      if (messages !== conversationHistory) {
        conversationHistory.push(toolCallMsg);
      }

      var toolResponses = [];
      for (var i = 0; i < toolCalls.length; i++) {
        var tc = toolCalls[i];
        if (typeof addLog === 'function') {
          addLog('info', `Executing tool: ${tc.name}...`);
        }
        var toolResult = await executeTool(tc.name, tc.args);
        toolResponses.push({
          id: tc.id,
          name: tc.name,
          response: toolResult
        });
      }

      var toolRespMsg = { role: 'tool', tool_responses: toolResponses };
      messages.push(toolRespMsg);
      if (messages !== conversationHistory) {
        conversationHistory.push(toolRespMsg);
      }

      continue;
    } else {
      var text = msg.content || '';
      var assistantMsg = { role: 'assistant', content: text };
      var alreadyPushed = false;
      if (messages.length > 0) {
        var last = messages[messages.length - 1];
        if (last.role === 'assistant' && last.content === text) {
          alreadyPushed = true;
        }
      }
      if (!alreadyPushed) {
        messages.push(assistantMsg);
        if (messages !== conversationHistory) {
          conversationHistory.push(assistantMsg);
        }
      }
      return text;
    }
  }
  throw new Error('Too many tool calling iterations (max 5).');
}

/* ----------------------------------------------------------
 *  9. generateDemoResponse(userMessage)
 *  Smart offline / demo mode. Pattern-matches the user's
 *  message and returns a contextual reply about Oppie's
 *  capabilities — no API key required.
 * ---------------------------------------------------------- */
function generateDemoResponse(userMessage) {

  var lower = userMessage.toLowerCase().trim();

  // Grab user's first name if available
  var name = '';
  if (typeof googleUser !== 'undefined' && googleUser && googleUser.given_name) {
    name = googleUser.given_name;
  } else if (typeof state !== 'undefined' && state && state.user && state.user.name) {
    name = state.user.name.split(' ')[0];
  }

  var greeting = name ? 'Hey ' + name + '!' : 'Hey there!';
  var text = '';

  // --- Greetings ---
  if (/^(hi|hello|hey|howdy|sup|yo|what'?s up|good (morning|afternoon|evening))/.test(lower)) {
    text =
      greeting +
      ' 👋 I\'m **Oppie**, your autonomous background agent. I can keep an eye on your Gmail, manage your Calendar, browse Drive, and a lot more — all while you do other things.\n\n' +
      'Ask me to *monitor* something, or type **"help"** to see everything I can do!';
  }
  // --- Email / Gmail ---
  else if (/\b(email|gmail|inbox|mail|message)\b/.test(lower)) {
    text =
      greeting.replace('!', ',') +
      ' I can work with your **Gmail** in the background:\n\n' +
      '- 📬 Watch for new emails matching criteria you set\n' +
      '- 🔍 Search and summarise threads\n' +
      '- 🚨 Alert you when high-priority messages land\n\n' +
      'Connect your Google account and I\'ll spin up a background daemon that polls your inbox on a cadence you choose.';
  }
  // --- Calendar / Schedule ---
  else if (/\b(calendar|schedule|event|meeting|appointment|agenda)\b/.test(lower)) {
    text =
      'Sure thing! With **Google Calendar** connected I can:\n\n' +
      '- 📅 Create and update events on your behalf\n' +
      '- ⏰ Remind you about upcoming meetings\n' +
      '- 🔄 Watch for conflicts and double-bookings\n\n' +
      'Just tell me what to schedule and I\'ll handle the rest.';
  }
  // --- Capabilities / Help ---
  else if (/\b(help|capabilit|what can you|what do you|feature|scope)\b/.test(lower)) {
    text =
      'Here\'s what I can do when your Google services are connected:\n\n' +
      '| Service | What I do |\n' +
      '|---|---|\n' +
      '| **Gmail** | Monitor inbox, summarise threads, flag important emails |\n' +
      '| **Calendar** | Create events, check for conflicts, send reminders |\n' +
      '| **Drive** | Browse & search files, organise folders |\n' +
      '| **Sheets** | Read and analyse spreadsheet data |\n' +
      '| **Slides** | Summarise presentation content |\n' +
      '| **Tasks** | Manage to-do lists, mark items complete |\n' +
      '| **Maps** | Show locations, directions, points of interest |\n\n' +
      'I run **persistently** in this tab — think of me as a background daemon, not a one-shot chatbot. 🤖';
  }
  // --- Monitor / Watch ---
  else if (/\b(monitor|watch|daemon|automat|background|poll|track)\b/.test(lower)) {
    text =
      'Great idea! Here\'s how monitoring works:\n\n' +
      '1. You tell me **what** to watch (e.g. "new emails from my boss")\n' +
      '2. I spin up a **background daemon** in this tab\n' +
      '3. The daemon polls on a cadence you pick (e.g. every 2 minutes)\n' +
      '4. When a match is found, I surface a notification + summary\n\n' +
      'The daemon keeps running even if you switch to another part of the page. ' +
      'Connect an API key and your Google account to get started!';
  }
  // --- Drive / Files ---
  else if (/\b(drive|file|folder|document|doc)\b/.test(lower)) {
    text =
      'With **Google Drive** connected I can:\n\n' +
      '- 📁 List and search your files & folders\n' +
      '- 📄 Open and summarise documents\n' +
      '- 🗂️ Help you organise files into folders\n\n' +
      'Everything happens right here in the background — no need to switch tabs.';
  }
  // --- Tasks / Todo ---
  else if (/\b(task|todo|to-do|checklist|remind)\b/.test(lower)) {
    text =
      'I integrate with **Google Tasks** so I can:\n\n' +
      '- ✅ Create new tasks and set due dates\n' +
      '- 📋 List your existing tasks across all lists\n' +
      '- ✔️ Mark items as complete\n' +
      '- 🔔 Nudge you about overdue items\n\n' +
      'Just say something like *"add a task to review the budget by Friday"*.';
  }
  // --- Maps / Location ---
  else if (/\b(map|location|direction|place|address|navigate)\b/.test(lower)) {
    text =
      'With **Google Maps** I can:\n\n' +
      '- 📍 Show locations and points of interest\n' +
      '- 🗺️ Get directions between places\n' +
      '- 🏢 Look up business info and reviews\n\n' +
      'Try asking me for directions or to find a place near you!';
  }
  // --- General fallback ---
  else {
    var fallbacks = [
      greeting +
        " I'm running in **demo mode** right now (no API key set). " +
        'Add one in Settings → AI to unlock my full capabilities!\n\n' +
        'In the meantime, ask me about **email monitoring**, **calendar management**, or type **"help"** to see everything I can do.',
      greeting.replace('!', '!') +
        " That's an interesting request. In full mode I'd hand that off to the right Google service and process it in the background. " +
        'Set up an API key in **Settings → AI** to activate me!',
      "I'd love to help with that! Right now I'm in **demo mode** — " +
        'connect an AI provider in Settings to let me work autonomously.\n\n' +
        'Meanwhile, I can tell you about any of my capabilities — just ask!',
    ];
    text = fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  conversationHistory.push({ role: 'assistant', content: text });
  return text;
}

/* ----------------------------------------------------------
 *  8. detectServiceContext(text)
 *  Returns the Google-service key most relevant to the user
 *  message, or null for general conversation.
 * ---------------------------------------------------------- */
function detectServiceContext(text) {
  var lower = (text || '').toLowerCase();

  if (/\b(gmail|email|inbox|mail|message|send\s+an?\s+email)\b/.test(lower)) return 'gmail';
  if (/\b(calendar|schedule|event|meeting|appointment|agenda|book\s+a)\b/.test(lower)) return 'calendar';
  if (/\b(map|location|direction|place|address|navigate|nearby|route)\b/.test(lower)) return 'maps';
  if (/\b(sheet|spreadsheet|csv|table|row|column|cell)\b/.test(lower)) return 'sheets';
  if (/\b(slide|presentation|deck|powerpoint)\b/.test(lower)) return 'slides';
  if (/\b(drive|file|folder|document|upload|download)\b/.test(lower)) return 'drive';
  if (/\b(form|survey|questionnaire|response)\b/.test(lower)) return 'forms';
  if (/\b(task|todo|to-do|checklist|remind)\b/.test(lower)) return 'tasks';
  if (/\b(search|google|look\s+up|find\s+out|browse\s+the\s+web)\b/.test(lower)) return 'google';
  if (/\b(help|capabilit|what can you|scope|feature)\b/.test(lower)) return 'capabilities';

  return null;
}

/* ----------------------------------------------------------
 *  9. clearConversationHistory()
 * ---------------------------------------------------------- */
function clearConversationHistory() {
  conversationHistory = [];
}
