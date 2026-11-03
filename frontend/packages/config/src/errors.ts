export type ConfigIssue = Readonly<{
  path: string;
  message: string;
}>;

export class ConfigError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(message: string, issues: readonly ConfigIssue[] = []) {
    super(
      issues.length > 0
        ? `${message}: ${issues.map((issue) => `[${issue.path}] ${issue.message}`).join(', ')}`
        : message,
    );
    this.name = 'ConfigError';
    this.issues = issues;
  }
}
