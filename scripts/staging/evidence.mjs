import { execFileSync } from 'node:child_process'
export function gitIdentity() {
  const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim()
  const untrackedSource = git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/)
    .filter(path => path && !path.startsWith('raw/'))
  return { commit: git(['rev-parse', 'HEAD']),
    workingTreeDirty: Boolean(git(['diff', '--name-only', 'HEAD']) || untrackedSource.length) }
}
