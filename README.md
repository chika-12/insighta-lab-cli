# Insighta Labs+ CLI

A command-line interface for interacting with the Insighta Labs+ Profiles API. Built with Node.js and Commander.js, it supports GitHub OAuth authentication, role-based access control, and natural language profile search — all from your terminal.

---

## System Architecture

The CLI is split into three layers that each have a single responsibility:

```
insighta-cli/
├── bin/
│   └── insighta.js          # Entry point — wires all commands together
├── src/
│   ├── auth/
│   │   └── tokenStore.js    # Reads and writes tokens to ~/.insighta/tokens.json
│   ├── api/
│   │   └── client.js        # Axios instance — handles auth headers and token refresh
│   └── commands/
│       ├── login.js         # Opens browser, catches OAuth callback on :4242
│       ├── logout.js        # Revokes session on backend, clears local tokens
│       └── profiles/
│           └── index.js     # list, get, export subcommands
```

The CLI communicates with a live backend hosted on Railway:

```
https://hngintern-production-7bfd.up.railway.app/api/v1
```

All profile data is stored in MongoDB. The backend is built with Express and uses JWT for stateless authentication.

---

## Authentication Flow

The CLI uses GitHub OAuth with PKCE (Proof Key for Code Exchange), handled entirely on the backend. Here is the step by step flow:

```
1. User runs:        insighta login
2. CLI opens:        https://<backend>/api/v1/auth/github?source=cli
3. Backend:          generates PKCE pair, stores in cookies, redirects to GitHub
4. GitHub:           user logs in and authorizes the app
5. GitHub:           redirects to backend callback URL with authorization code
6. Backend:          exchanges code for GitHub access token, fetches user info
7. Backend:          creates or updates user in MongoDB, generates JWT tokens
8. Backend:          detects source=cli, redirects to:
                     http://localhost:4242/?accessToken=...&refreshToken=...
9. CLI:              local server on port 4242 catches the redirect
10. CLI:             saves both tokens to ~/.insighta/tokens.json
11. Terminal:        prints "Logged in successfully!"
```

The `source=cli` query parameter is what tells the backend to redirect tokens to `localhost:4242` instead of the web portal.

---

## CLI Usage

## Installation

### Option 1 — Install directly from GitHub

```bash
npm install -g github:https://github.com/chika-12/insighta-lab-cli
```

Then use it from anywhere:

```bash
insighta --help
```

### Option 2 — Clone and link locally

```bash
git clone <repo-url>
cd insighta-cli
npm install
npm link
```

### Option 3 — Install from npm

```bash
npm install -g insighta_adv_cli
```

### Available Commands

```bash
insighta login                          # Authenticate via GitHub OAuth
insighta logout                         # Clear local session
insighta whoami                         # Show currently logged in user

insighta profiles list                  # List all profiles
insighta profiles list --page 2         # Paginate results
insighta profiles list --limit 10       # Set results per page
insighta profiles list --sort name      # Sort by field
insighta profiles list --search "women from ghana"   # Natural language search

insighta profiles get <id>              # Get a single profile by ID
insighta profiles export                # Export all profiles to CSV (admin only)
insighta profiles export -o myfile.csv  # Export with custom filename
```

### Help

```bash
insighta --help
insighta profiles --help
insighta profiles list --help
```

---

## Token Handling Approach

Tokens are stored locally in a hidden directory in the user's home folder:

```
~/.insighta/tokens.json
```

The file contains:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "savedAt": 1714000000000
}
```

**Security:**

- The `~/.insighta/` directory is created with `mode: 0o700` — only the OS user can access it
- The `tokens.json` file is written with `mode: 0o600` — only the OS user can read it
- No tokens are ever stored in environment variables or the project directory

**Automatic Refresh:**

The Axios client in `src/api/client.js` handles token expiry silently using response interceptors:

```
1. Request goes out with access token in Authorization header
2. Backend returns 401 (token expired)
3. Interceptor catches the 401
4. Interceptor sends refresh token to POST /api/v1/auth/refresh
5. New access token is saved to ~/.insighta/tokens.json
6. Original request is retried automatically with the new token
7. User never sees an error
```

If the refresh token is also expired, the CLI clears local tokens and prompts the user to run `insighta login` again.

---

## Role Enforcement Logic

The backend enforces two roles — `admin` and `analyst`. The CLI respects these roles automatically since the backend returns `403 Forbidden` for unauthorized actions.

| Command                  | Required Role          |
| ------------------------ | ---------------------- |
| `profiles list`          | Any authenticated user |
| `profiles get <id>`      | Any authenticated user |
| `profiles export`        | Admin only             |
| `profiles list --search` | Any authenticated user |

When an admin-only route is accessed by a non-admin user, the CLI catches the 403 and prints a clear message:

```
✖  Access denied — admin role required.
```

The role is embedded in the JWT access token by the backend at login time:

```js
generateAccessToken(user._id, user.role);
```

So the backend always knows the user's role without an extra database call on every request.

---

## Natural Language Parsing Approach

Natural language search is handled entirely on the backend via a custom `parseSearchQuery` function. The CLI sends the raw query string to a dedicated search route:

```
GET /api/v1/profiles/search?q=women from ghana
```

The backend parser interprets the query and maps it to MongoDB filters. For example:

| Query                | Interpreted Filter                          |
| -------------------- | ------------------------------------------- |
| `"women from ghana"` | `{ gender: "female", country_id: "GH" }`    |
| `"adult males"`      | `{ gender: "male", age_group: "adult" }`    |
| `"senior women"`     | `{ gender: "female", age_group: "senior" }` |

The backend also returns an `interpreted` field in the response showing exactly how it parsed the query — useful for debugging unexpected results.

On the CLI side, when the `--search` flag is detected, the `listProfiles` function automatically routes to `/profiles/search` with the `q` parameter instead of the standard `/profiles` route:

```js
if (opts.search) {
  const { data } = await client.get('/profiles/search', {
    params: { q: opts.search, page: opts.page, limit: opts.limit },
  });
}
```

---

## Environment

The CLI points to the live Railway backend by default. No environment setup is needed for end users.

For local development against a different backend:

```bash
export INSIGHTA_API_URL=http://localhost:5000
```

---

## Dependencies

| Package     | Purpose                                           |
| ----------- | ------------------------------------------------- |
| `commander` | CLI framework — parses commands and options       |
| `axios`     | HTTP client — talks to the backend API            |
| `open`      | Opens the GitHub OAuth URL in the default browser |
