/* ============================================================
   google-auth.js — Google OAuth 2.0 via Google Identity Services
   Browser-side vanilla JS. No modules/imports.
   All functions & variables are intentionally global.
   ============================================================ */

// --------------- Constants ---------------
var GOOGLE_CLIENT_ID =
  '976947677770-h5fm4q9mdpaafvf4t78it3nfqkjk0491.apps.googleusercontent.com';

var GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/presentations.readonly',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/tasks.readonly',
].join(' ');

// --------------- Global state ---------------
var googleAccessToken = null;
var googleUser = null; // { name, email, picture, given_name, sub }

// --------------- Internal state ---------------
var _tokenClient = null;
var _onAuthSuccess = null; // callback provided by app.js

// =============================================
// 1. initGoogleAuth(onSuccess)
// =============================================
/**
 * Initialise the GIS token client.
 *
 * @param {function(object, string)} onSuccess — called with (googleUser, googleAccessToken)
 * after a successful sign-in / token refresh.
 * @returns {boolean} true if initialisation succeeded, false otherwise.
 */
function initGoogleAuth(onSuccess) {
  // 1. Save the callback immediately, even if the GIS library hasn't loaded yet.
  if (onSuccess) {
    _onAuthSuccess = onSuccess;
  }

  // 2. Then check if Google is ready.
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
    console.warn(
      '[google-auth] Google Identity Services library not loaded. ' +
      'Make sure the GIS script tag is present before this file.'
    );
    return false;
  }

  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    callback: _handleTokenResponse,
  });

  console.log('[google-auth] Token client initialised.');
  return true;
}

// =============================================
// 2. requestGoogleSignIn()
// =============================================
/**
 * Prompt the user to sign in / grant consent.
 * If the token client has not been initialised yet we attempt to do so first.
 */
function requestGoogleSignIn() {
  if (!_tokenClient) {
    var ok = initGoogleAuth(_onAuthSuccess);
    if (!ok) {
      console.error('[google-auth] Cannot sign in — GIS library unavailable.');
      return false;
    }
  }
  _tokenClient.requestAccessToken({ prompt: 'consent' });
  return true;
}

// =============================================
// 3. requestGoogleReAuth()
// =============================================
/**
 * Silently request a fresh access token (no consent prompt).
 * Useful for token refresh without user interaction.
 */
function requestGoogleReAuth() {
  if (!_tokenClient) {
    var ok = initGoogleAuth(_onAuthSuccess);
    if (!ok) {
      console.error('[google-auth] Cannot re-auth — GIS library unavailable.');
      return;
    }
  }
  _tokenClient.requestAccessToken({ prompt: '' });
}

// =============================================
// 4. Internal token-response handler
// =============================================
/**
 * Called by the GIS token client when a token response arrives.
 * Fetches the user profile, stores state, and invokes the app callback.
 *
 * @param {object} tokenResponse — response from GIS containing access_token or error.
 */
async function _handleTokenResponse(tokenResponse) {
  if (tokenResponse.error) {
    console.error('[google-auth] Token error:', tokenResponse.error, tokenResponse);
    return;
  }

  googleAccessToken = tokenResponse.access_token;

  try {
    var res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + googleAccessToken },
    });

    if (!res.ok) {
      throw new Error('Userinfo request failed: ' + res.status + ' ' + res.statusText);
    }

    var profile = await res.json();

    googleUser = {
      name: profile.name || '',
      email: profile.email || '',
      picture: profile.picture || '',
      given_name: profile.given_name || '',
      sub: profile.sub || '',
    };

    console.log('[google-auth] Signed in as', googleUser.email);

    if (typeof _onAuthSuccess === 'function') {
      _onAuthSuccess(googleUser, googleAccessToken);
    }
  } catch (err) {
    console.error('[google-auth] Failed to fetch user profile:', err);
  }
}

// =============================================
// 5. googleApiFetch(url, options)
// =============================================
/**
 * Thin wrapper around fetch() that injects the Authorization header.
 *
 * @param {string} url
 * @param {object} [options={}] — standard fetch options (method, body, headers …)
 * @returns {Promise<Response>}
 */
async function googleApiFetch(url, options) {
  if (!googleAccessToken) {
    throw new Error('[google-auth] No access token available. Sign in first.');
  }

  var opts = options || {};
  opts.headers = Object.assign({}, opts.headers || {}, {
    Authorization: 'Bearer ' + googleAccessToken,
  });

  var res = await fetch(url, opts);

  if (!res.ok) {
    var errorBody = '';
    try {
      errorBody = await res.text();
    } catch (_) {
      /* ignore */
    }
    throw new Error(
      '[google-auth] API request failed: ' +
      res.status +
      ' ' +
      res.statusText +
      ' — ' +
      errorBody
    );
  }

  return res;
}

// =============================================
// 6. fetchRecentEmails(query, maxResults)
// =============================================
/**
 * Fetch recent Gmail messages matching an optional query.
 *
 * @param {string}  [query='']       — Gmail search query (e.g. "is:unread").
 * @param {number}  [maxResults=5]   — Maximum number of messages to return.
 * @returns {Promise<Array<{id:string, from:string, subject:string, date:string, snippet:string}>>}
 */
async function fetchRecentEmails(query, maxResults) {
  if (maxResults === undefined || maxResults === null) maxResults = 5;

  try {
    var listUrl =
      'https://www.googleapis.com/gmail/v1/users/me/messages?' +
      'maxResults=' + encodeURIComponent(maxResults);

    if (query) {
      listUrl += '&q=' + encodeURIComponent(query);
    }

    var listRes = await googleApiFetch(listUrl);
    var listData = await listRes.json();

    if (!listData.messages || listData.messages.length === 0) {
      return [];
    }

    var emails = [];

    for (var i = 0; i < listData.messages.length; i++) {
      var msgId = listData.messages[i].id;
      var msgUrl =
        'https://www.googleapis.com/gmail/v1/users/me/messages/' +
        msgId +
        '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date';

      var msgRes = await googleApiFetch(msgUrl);
      var msgData = await msgRes.json();

      var from = '';
      var subject = '';
      var date = '';

      if (msgData.payload && msgData.payload.headers) {
        for (var h = 0; h < msgData.payload.headers.length; h++) {
          var header = msgData.payload.headers[h];
          var headerName = header.name.toLowerCase();
          if (headerName === 'from') from = header.value;
          if (headerName === 'subject') subject = header.value;
          if (headerName === 'date') date = header.value;
        }
      }

      emails.push({
        id: msgId,
        from: from,
        subject: subject,
        date: date,
        snippet: msgData.snippet || '',
      });
    }

    return emails;
  } catch (err) {
    console.error('[google-auth] fetchRecentEmails failed:', err);
    throw new Error('Failed to fetch emails: ' + err.message);
  }
}

// =============================================
// 7. fetchCalendarEvents(maxResults)
// =============================================
/**
 * Fetch upcoming events from the user's primary Google Calendar.
 *
 * @param {number} [maxResults=5]
 * @returns {Promise<Array<object>>} — array of Calendar event resources.
 */
async function fetchCalendarEvents(maxResults) {
  if (maxResults === undefined || maxResults === null) maxResults = 5;

  try {
    var now = new Date().toISOString();
    var url =
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?' +
      'maxResults=' + encodeURIComponent(maxResults) +
      '&timeMin=' + encodeURIComponent(now) +
      '&orderBy=startTime' +
      '&singleEvents=true';

    var res = await googleApiFetch(url);
    var data = await res.json();

    return data.items || [];
  } catch (err) {
    console.error('[google-auth] fetchCalendarEvents failed:', err);
    throw new Error('Failed to fetch calendar events: ' + err.message);
  }
}

// =============================================
// 8. createCalendarEvent(summary, startTime, endTime, description)
// =============================================
/**
 * Create a new event on the user's primary Google Calendar.
 *
 * @param {string} summary     — event title.
 * @param {string} startTime   — ISO 8601 datetime string for start.
 * @param {string} endTime     — ISO 8601 datetime string for end.
 * @param {string} [description=''] — optional event description.
 * @returns {Promise<object>} — the created Calendar event resource.
 */
async function createCalendarEvent(summary, startTime, endTime, description) {
  try {
    var event = {
      summary: summary,
      description: description || '',
      start: { dateTime: startTime },
      end: { dateTime: endTime },
    };

    var res = await googleApiFetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      }
    );

    return await res.json();
  } catch (err) {
    console.error('[google-auth] createCalendarEvent failed:', err);
    throw new Error('Failed to create calendar event: ' + err.message);
  }
}

// =============================================
// 9. fetchDriveFiles(maxResults)
// =============================================
/**
 * Fetch files from the user's Google Drive.
 *
 * @param {number} [maxResults=10]
 * @returns {Promise<Array<{id:string, name:string, mimeType:string, modifiedTime:string, size:string}>>}
 */
async function fetchDriveFiles(maxResults) {
  if (maxResults === undefined || maxResults === null) maxResults = 10;

  try {
    var url =
      'https://www.googleapis.com/drive/v3/files?' +
      'pageSize=' + encodeURIComponent(maxResults) +
      '&fields=' + encodeURIComponent('files(id,name,mimeType,modifiedTime,size)') +
      '&orderBy=' + encodeURIComponent('modifiedTime desc');

    var res = await googleApiFetch(url);
    var data = await res.json();

    return (data.files || []).map(function (f) {
      return {
        id: f.id || '',
        name: f.name || '',
        mimeType: f.mimeType || '',
        modifiedTime: f.modifiedTime || '',
        size: f.size || '',
      };
    });
  } catch (err) {
    console.error('[google-auth] fetchDriveFiles failed:', err);
    throw new Error('Failed to fetch Drive files: ' + err.message);
  }
}

// =============================================
// 10. fetchTasks()
// =============================================
/**
 * Fetch tasks from the user's first Google Tasks list.
 *
 * @returns {Promise<Array<object>>} — array of Task resources.
 */
async function fetchTasks() {
  try {
    // Step 1 — get all task lists
    var listsRes = await googleApiFetch(
      'https://www.googleapis.com/tasks/v1/users/@me/lists'
    );
    var listsData = await listsRes.json();

    if (!listsData.items || listsData.items.length === 0) {
      return [];
    }

    var firstListId = listsData.items[0].id;

    // Step 2 — get tasks from the first list
    var tasksRes = await googleApiFetch(
      'https://www.googleapis.com/tasks/v1/lists/' +
      encodeURIComponent(firstListId) +
      '/tasks'
    );
    var tasksData = await tasksRes.json();

    return tasksData.items || [];
  } catch (err) {
    console.error('[google-auth] fetchTasks failed:', err);
    throw new Error('Failed to fetch tasks: ' + err.message);
  }
}

// =============================================
// 11. sendGmail(to, subject, body)
// =============================================
/**
 * Send an email via the Gmail API.
 * Constructs an RFC 2822 message and encodes it as base64url.
 *
 * @param {string} to      — recipient email address.
 * @param {string} subject — email subject line.
 * @param {string} body    — plain-text email body.
 * @returns {Promise<object>} — Gmail send response.
 */
async function sendGmail(to, subject, body) {
  try {
    // Build RFC 2822 message
    var messageParts = [
      'To: ' + to,
      'Subject: ' + subject,
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      '',
      body,
    ];
    var rawMessage = messageParts.join('\r\n');

    // Base64url encode (browser-safe)
    var encoded = _base64urlEncode(rawMessage);

    var res = await googleApiFetch(
      'https://www.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: encoded }),
      }
    );

    return await res.json();
  } catch (err) {
    console.error('[google-auth] sendGmail failed:', err);
    throw new Error('Failed to send email: ' + err.message);
  }
}

// =============================================
// Internal: base64url encoding helper
// =============================================
/**
 * Encode a UTF-8 string to base64url (RFC 4648 §5) using browser APIs.
 *
 * @param {string} str — the string to encode.
 * @returns {string} base64url-encoded string (no padding).
 */
function _base64urlEncode(str) {
  // Encode the string as UTF-8 bytes first
  var bytes = new TextEncoder().encode(str);

  // Convert bytes to a binary string that btoa can handle
  var binary = '';
  for (var i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  // Standard base64 → base64url: replace +/ with -_, strip padding
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}