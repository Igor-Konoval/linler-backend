const { execFileSync } = require('node:child_process');

const PROTECTED = new Set(['main', 'master']);

function emit(payload) {
  process.stdout.write(JSON.stringify(payload));
}

function deny(agentMessage) {
  emit({
    permission: 'deny',
    user_message:
      'Push to main is blocked. Ship the change from a feature branch through a pull request.',
    agent_message: agentMessage,
  });
}

function allow() {
  emit({ permission: 'allow' });
}

function currentBranch() {
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function unquote(token) {
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    return token.slice(1, -1);
  }
  return token;
}

function branchName(ref) {
  const bare = ref.replace(/^\+/, '');
  const short = bare.replace(/^(refs\/heads\/|refs\/remotes\/[^/]+\/)/, '');
  return short;
}

function destination(refspec) {
  const value = unquote(refspec);
  if (value.includes(':')) {
    return branchName(value.split(':').pop());
  }
  return branchName(value);
}

function isProtected(name) {
  return PROTECTED.has(name);
}

function refspecIsProtected(refspec) {
  const name = destination(refspec);
  if (name !== 'HEAD' && name !== '@') return isProtected(name);

  try {
    return isProtected(currentBranch());
  } catch {
    return true;
  }
}

function splitSegments(command) {
  const segments = [];
  let current = '';
  let quote = '';

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    const next = command[index + 1];

    if (quote) {
      current += char;
      if (char === quote) quote = '';
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    const isBreak =
      char === ';' ||
      char === '\n' ||
      (char === '&' && next === '&') ||
      (char === '|' && next === '|') ||
      (char === '|' && next !== '|');

    if (isBreak) {
      segments.push(current);
      current = '';
      if (char !== ';' && char !== '\n') index += 1;
      continue;
    }

    current += char;
  }

  segments.push(current);
  return segments;
}

function tokenize(segment) {
  const tokens = [];
  let current = '';
  let quote = '';

  for (const char of segment) {
    if (quote) {
      current += char;
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  if (current) tokens.push(current);
  return tokens;
}

function gitPushArgs(tokens) {
  let index = tokens.findIndex((token) =>
    /^(?:.*[\\/])?git(?:\.exe)?$/i.test(unquote(token)),
  );
  if (index === -1) return null;
  index += 1;

  if (unquote(tokens[index] || '') === '-C') {
    index += 2;
  }

  if (unquote(tokens[index] || '').toLowerCase() !== 'push') return null;
  return tokens.slice(index + 1).map(unquote);
}

function inspectPush(args) {
  if (args.some((arg) => arg === '--all' || arg === '--mirror')) {
    return 'deny';
  }

  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') {
      positionals.push(...args.slice(index + 1));
      break;
    }
    if (arg.startsWith('-')) {
      if (
        arg.includes('=') ||
        arg === '--repo' ||
        arg === '--receive-pack' ||
        arg === '--exec'
      ) {
        continue;
      }
      continue;
    }
    positionals.push(arg);
  }

  const refspecs = positionals.length > 1 ? positionals.slice(1) : [];
  if (refspecs.some((refspec) => refspecIsProtected(refspec))) {
    return 'deny';
  }
  if (refspecs.length > 0) return 'allow';

  try {
    return isProtected(currentBranch()) ? 'deny' : 'allow';
  } catch {
    return 'deny';
  }
}

function main() {
  let command = '';
  try {
    const input = JSON.parse(
      require('node:fs').readFileSync(0, 'utf8') || '{}',
    );
    command = String(input.command || '');
  } catch {
    deny('The push hook received invalid JSON, so the command was blocked.');
    return;
  }

  for (const segment of splitSegments(command)) {
    const args = gitPushArgs(tokenize(segment));
    if (!args) continue;
    if (inspectPush(args) === 'deny') {
      deny(
        'Blocked git push because it would update main. Push the feature branch and open a pull request.',
      );
      return;
    }
  }

  allow();
}

main();
