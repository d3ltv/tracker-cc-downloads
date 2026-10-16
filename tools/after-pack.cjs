'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
// Sign inside out. Preserve valid vendor framework signatures; sign changed helpers and app.
// Ad-hoc signing supplies local integrity, not a Developer ID or notarization.
module.exports = async function (context) {
  if (context.electronPlatformName !== 'darwin') return;
  const bundle = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const frameworks=path.join(bundle,'Contents','Frameworks');
  const sign=file=>execFileSync('/usr/bin/codesign',['--force','--sign','-',file],{stdio:'inherit'});
  for(const name of fs.readdirSync(frameworks).filter(x=>x.endsWith('.framework'))){
    const file=path.join(frameworks,name);
    try{execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',file],{stdio:'pipe'});}
    catch{execFileSync('/usr/bin/codesign',['--force','--deep','--sign','-',file],{stdio:'inherit'});}
  }
  for(const name of fs.readdirSync(frameworks).filter(x=>x.endsWith('.app')))sign(path.join(frameworks,name));
  sign(bundle);
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle], { stdio: 'inherit' });
};
