import path from 'node:path';

// A package never depends on PATH, a developer override or a source checkout.
export function hostLaunch({ appRoot, resourcesPath, isPackaged, platform = process.platform }) {
  if (isPackaged) {
    if (!['win32', 'linux'].includes(platform)) throw new Error('Unsupported portable platform');
    return { executable: path.join(resourcesPath, 'host', platform === 'win32' ? 'Sun.Workspace.Host.exe' : 'Sun.Workspace.Host'), args: [] };
  }
  return { executable: process.env.ASTELVO_DOTNET ?? 'dotnet', args: [path.join(appRoot, 'src/Sun.Workspace.Host/bin/Release/net10.0/Sun.Workspace.Host.dll')] };
}
