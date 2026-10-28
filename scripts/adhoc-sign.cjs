// electron-builder afterPack hook.
// Without a Developer ID, electron-builder leaves the bundle with only the
// linker's partial signature, which macOS treats as broken ("app is damaged")
// once the dmg is downloaded from the internet. Re-sign the whole bundle
// ad-hoc so the signature is valid; users then only see the normal
// "unidentified developer" prompt.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' });
};
