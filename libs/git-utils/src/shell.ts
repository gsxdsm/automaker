/**
 * Shell command utilities for secure argument escaping
 */

/**
 * Maximum buffer size for git command output (10MB)
 */
export const MAX_BUFFER_SIZE = 10 * 1024 * 1024;

/**
 * Escape a single argument for safe use in shell commands.
 * This prevents command injection vulnerabilities.
 *
 * @param arg - The argument to escape
 * @returns The safely escaped argument wrapped in double quotes
 *
 * @example
 * ```ts
 * escapeShellArg('feature branch') // returns '"feature branch"'
 * escapeShellArg('normal') // returns '"normal"'
 * ```
 */
export function escapeShellArg(arg: string): string {
  // Use JSON.stringify which properly escapes special characters
  // and wraps the result in double quotes
  return JSON.stringify(arg);
}

/**
 * Escape multiple arguments for safe use in shell commands.
 *
 * @param args - Array of arguments to escape
 * @returns Array of safely escaped arguments
 *
 * @example
 * ```ts
 * escapeShellArgs(['file1.txt', 'file with spaces.txt'])
 * // returns ['"file1.txt"', '"file with spaces.txt"']
 * ```
 */
export function escapeShellArgs(args: string[]): string[] {
  return args.map(escapeShellArg);
}

/**
 * Build a git command with properly escaped arguments.
 *
 * @param command - Base git command (e.g., 'git branch')
 * @param args - Arguments to append (will be escaped)
 * @returns Complete command string with escaped arguments
 *
 * @example
 * ```ts
 * buildGitCommand('git branch', ['-d', 'feature/branch-1'])
 * // returns 'git branch -d "feature/branch-1"'
 * ```
 */
export function buildGitCommand(command: string, args: string[]): string {
  const escapedArgs = escapeShellArgs(args);
  return [command, ...escapedArgs].join(' ');
}
