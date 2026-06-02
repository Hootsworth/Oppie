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
    '- When the user asks you to monitor something, describe the background daemon you would spin up and what triggers / cadence it would use.\n' +
    '- Reference Google services by their proper names (Gmail, Google Calendar, etc.).\n' +
    '- Use **Markdown** formatting in your replies (headings, bold, lists, code blocks when useful).\n' +
    "- Don't be robotic or overly formal — you're a knowledgeable assistant who works quietly in the background.\n" +
    '- Remember: you are a **specialised background worker**, not a general-purpose chatbot.\n';

  if (state && state.ai && state.ai.customInstructions) {
    prompt += '\n## Custom Instructions from User\n' + state.ai.customInstructions + '\n';
  }

  return prompt;
}

/* ----------------------------------------------------------
 *  2. callAI(provider, model, apiKey, userMessage)
 *  Entry point for every chat turn. Manages history, routes
 *  to the right provider, and falls back to demo mode when
 *  there is no API key.
 * ---------------------------------------------------------- */
async function callAI(provider, model, apiKey, userMessage) {
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
 *  3. callGemini(apiKey, model, messages)
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

  // Map conversation history → Gemini format
  var contents = messages.map(function (msg) {
    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    };
  });

  var body = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: contents,
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

  if (
    !data.candidates ||
    !data.candidates[0] ||
    !data.candidates[0].content ||
    !data.candidates[0].content.parts ||
    !data.candidates[0].content.parts[0]
  ) {
    throw new Error('Gemini returned an unexpected response structure.');
  }

  var text = data.candidates[0].content.parts[0].text;
  conversationHistory.push({ role: 'assistant', content: text });
  return text;
}

/* ----------------------------------------------------------
 *  4. callOpenAI(apiKey, model, messages)
 * ---------------------------------------------------------- */
async function callOpenAI(apiKey, model, messages) {
  var systemPrompt = buildSystemPrompt(
    typeof state !== 'undefined' ? state : {},
    typeof googleUser !== 'undefined' ? googleUser : null
  );

  var apiMessages = [{ role: 'system', content: systemPrompt }];
  messages.forEach(function (msg) {
    apiMessages.push({ role: msg.role, content: msg.content });
  });

  var res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey,
    },
    body: JSON.stringify({
      model: model,
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    var errBody = await res.text();
    throw new Error('OpenAI API ' + res.status + ': ' + errBody);
  }

  var data = await res.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('OpenAI returned an unexpected response structure.');
  }

  var text = data.choices[0].message.content;
  conversationHistory.push({ role: 'assistant', content: text });
  return text;
}

/* ----------------------------------------------------------
 *  5. callClaude(apiKey, model, messages)
 * ---------------------------------------------------------- */
async function callClaude(apiKey, model, messages) {
  var systemPrompt = buildSystemPrompt(
    typeof state !== 'undefined' ? state : {},
    typeof googleUser !== 'undefined' ? googleUser : null
  );

  var apiMessages = messages.map(function (msg) {
    return { role: msg.role, content: msg.content };
  });

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
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    var errBody = await res.text();
    throw new Error('Claude API ' + res.status + ': ' + errBody);
  }

  var data = await res.json();

  if (!data.content || !data.content[0]) {
    throw new Error('Claude returned an unexpected response structure.');
  }

  var text = data.content[0].text;
  conversationHistory.push({ role: 'assistant', content: text });
  return text;
}

/* ----------------------------------------------------------
 *  6. callOpenRouter(apiKey, model, messages)
 * ---------------------------------------------------------- */
async function callOpenRouter(apiKey, model, messages) {
  var systemPrompt = buildSystemPrompt(
    typeof state !== 'undefined' ? state : {},
    typeof googleUser !== 'undefined' ? googleUser : null
  );

  var apiMessages = [{ role: 'system', content: systemPrompt }];
  messages.forEach(function (msg) {
    apiMessages.push({ role: msg.role, content: msg.content });
  });

  var res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Oppie Agent',
    },
    body: JSON.stringify({
      model: model,
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    var errBody = await res.text();
    throw new Error('OpenRouter API ' + res.status + ': ' + errBody);
  }

  var data = await res.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('OpenRouter returned an unexpected response structure.');
  }

  var text = data.choices[0].message.content;
  conversationHistory.push({ role: 'assistant', content: text });
  return text;
}

/* ----------------------------------------------------------
 *  7. generateDemoResponse(userMessage)
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
