import path from 'node:path';
import { statSync } from 'node:fs';
import { globSync as match } from 'glob';
import picomatch from 'picomatch';
export function globSync(pattern, options) {
  if (typeof pattern !== 'string' || !pattern || !options ||
      options.onlyDirectories !== true || Object.keys(options).length !== 1) {
    throw new TypeError('Next root-glob adapter requires a nonempty string and onlyDirectories:true');
  }
  if (pattern.startsWith('!') && !pattern.startsWith('!(')) return [];
  const absolute = path.isAbsolute(pattern);
  const leadingDot = pattern.startsWith('./');
  const trailingSlash = pattern.endsWith('/');
  const target = pattern.replace(/\/\*\*\/?$/, '/**/*');
  const matches = picomatch(path.resolve(target).replaceAll("\\", "/"), { dot: false, nonegate: true });
  return match(target, { follow: true, absolute: true, dot: true, windowsPathsNoEscape: true })
    .filter(entry => matches(entry.replaceAll('\\', '/')))
    .filter(entry => { try { return statSync(entry).isDirectory(); } catch (error) { if (['ENOENT','ENOTDIR'].includes(error.code)) return false; throw error; } })
    .map(entry => {
      let result = (absolute ? entry : path.relative(process.cwd(), entry)).replaceAll('\\', '/').replace(/\/$/, '');
      if (leadingDot && !result.startsWith('./')) result = './' + result;
      return trailingSlash ? result + '/' : result;
    });
}
