export interface PullRequestFile {
  filename: string;
  patch?: string | null;
  status?: string;
}

export interface SecretFinding {
  filePath: string;
  line: number | null;
  detector: string;
}

const sensitiveFilePatterns = [
  /(^|[\\/])[^\\/]*\.env(?:$|\.)/i,
  /(^|[\\/])\.npmrc$/i,
  /(^|[\\/])\.netrc$/i,
  /(^|[\\/])\.pypirc$/i,
  /(^|[\\/])(?:id_rsa|id_ed25519|credentials?)(?:$|[._-])/i,
  /\.(?:pem|key|p12|pfx)$/i,
];

const sensitiveNamePattern = /(?:secret|token|password|private[-_.]?key)/i;
const secretDetectors: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  {
    name: 'GitHub token',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  },
  { name: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
];

const assignmentPattern =
  /\b([A-Za-z][A-Za-z0-9_-]{0,62}(?:key|secret|token|password|passwd))\b\s*[:=]\s*["']?([A-Za-z0-9/+=._-]{8,})/gi;

function isSensitiveFilename(filePath: string): boolean {
  const baseName = filePath.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? '';
  if (/^\.env\.(?:example|sample|template|dist)$/.test(baseName)) return false;
  return (
    sensitiveFilePatterns.some((pattern) => pattern.test(filePath)) ||
    sensitiveNamePattern.test(baseName)
  );
}

function isPlaceholderValue(value: string): boolean {
  return (
    /^(?:changeme|change-me|example|placeholder|redacted|your[-_][a-z0-9_-]+|replace[-_][a-z0-9_-]+|test[-_][a-z0-9_-]+|dummy[-_][a-z0-9_-]+|x{3,})$/i.test(
      value,
    ) || /^(?:process\.env|env)\./i.test(value)
  );
}

function scanAddedLine(filePath: string, lineNumber: number, line: string): SecretFinding[] {
  const findings: SecretFinding[] = [];

  for (const detector of secretDetectors) {
    if (detector.pattern.test(line)) {
      findings.push({ filePath, line: lineNumber, detector: detector.name });
    }
    detector.pattern.lastIndex = 0;
  }

  if (findings.length === 0) {
    for (const match of line.matchAll(assignmentPattern)) {
      const value = match[2].toLowerCase();
      if (!isPlaceholderValue(value)) {
        findings.push({
          filePath,
          line: lineNumber,
          detector: `${match[1]} assignment`,
        });
      }
    }
  }
  assignmentPattern.lastIndex = 0;

  return findings;
}

function scanPatch(filePath: string, patch: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  let newLineNumber: number | null = null;

  for (const line of patch.split(/\r?\n/)) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      newLineNumber = Number(hunk[1]);
      continue;
    }

    if (newLineNumber === null || line.startsWith('+++') || line.startsWith('---')) continue;

    if (line.startsWith('+')) {
      findings.push(...scanAddedLine(filePath, newLineNumber, line.slice(1)));
      newLineNumber += 1;
    } else if (line.startsWith(' ')) {
      newLineNumber += 1;
    }
  }

  return findings;
}

export function scanPullRequestFiles(files: PullRequestFile[]): SecretFinding[] {
  const findings: SecretFinding[] = [];

  for (const file of files) {
    if (file.status !== 'removed' && isSensitiveFilename(file.filename)) {
      findings.push({
        filePath: file.filename,
        line: null,
        detector: 'Sensitive filename',
      });
    }
    if (file.patch) findings.push(...scanPatch(file.filename, file.patch));
  }

  const uniqueFindings = new Map<string, SecretFinding>();
  for (const finding of findings) {
    const key = `${finding.filePath}\0${finding.line ?? ''}\0${finding.detector}`;
    uniqueFindings.set(key, finding);
  }
  return [...uniqueFindings.values()];
}
