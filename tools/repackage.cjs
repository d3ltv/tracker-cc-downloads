'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {Readable}=require('node:stream'),{pipeline}=require('node:stream/promises');
const asar=require('@electron/asar'),{path7za}=require('7zip-bin');
const [platform,arch]=process.argv.slice(2),version=process.env.RELEASE_VERSION,expected=process.env.PAYLOAD_SHA256;
if(!['mac','win'].includes(platform)||arch!=='x64'||platform==='mac'&&process.platform!=='darwin'||platform==='win'&&process.platform!=='win32')throw Error('Use the matching native OS for mac x64 or win x64.');
if(!/^\d+\.\d+\.\d+$/.test(version||'')||!/^[a-f\d]{64}$/.test(expected||''))throw Error('Invalid release version or payload checksum.');
const run=(file,args)=>execFileSync(file,args,{stdio:'inherit',env:{...process.env,CSC_IDENTITY_AUTO_DISCOVERY:'false'}});
async function main(){
 fs.mkdirSync('payload',{recursive:true});
 const archive=path.resolve('payload/mac-arm64.zip');
 const response=await fetch(`https://github.com/d3ltv/tracker-cc-downloads/releases/download/v${version}/Tracker-CC-${version}-mac-arm64.zip`,{signal:AbortSignal.timeout(600000)});
 if(response.status!==200)throw Error(`Published payload returned HTTP ${response.status}`);
 await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(archive));
 const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(archive))hash.update(chunk);
 if(hash.digest('hex')!==expected)throw Error('The published ZIP checksum differs.');
 run(path7za,['x',archive,'-opayload','-y','Tracker C.C.app/Contents/Resources/app.asar','Tracker C.C.app/Contents/Resources/icon.icns','Tracker C.C.app/Contents/Info.plist']);
 const resources=path.resolve('payload/Tracker C.C.app/Contents/Resources');
 asar.extractAll(path.join(resources,'app.asar'),path.resolve('app'));
 const pkg=JSON.parse(fs.readFileSync('app/package.json','utf8'));
 if(pkg.version!==version||pkg.name!=='tracker-cc'||pkg.main!=='src/main.js')throw Error('Unexpected application identity.');
 // Pin the Electron runtime used by the verified source release.
 const info=fs.readFileSync('payload/Tracker C.C.app/Contents/Info.plist','utf8');
 if(!info.includes('<string>Tracker C.C</string>'))throw Error('Unexpected Mac bundle identity.');
 const config={appId:'fr.charly.appels',productName:'Tracker C.C',electronVersion:'44.7.0',directories:{app:'app',output:'dist',buildResources:'tools'},files:['**/*'],asar:true,npmRebuild:false,afterPack:path.resolve('tools/after-pack.cjs'),
  mac:{icon:path.join(resources,'icon.icns'),identity:null,hardenedRuntime:false,notarize:false,artifactName:'Tracker-CC-${version}-mac-${arch}.${ext}',extendInfo:{NSMicrophoneUsageDescription:'Tracker C.C. utilise le micro pour enregistrer les conversations.',CFBundleDisplayName:'Tracker C.C.'}},
  dmg:{title:'Tracker C.C.',contents:[{x:150,y:160,type:'file'},{x:430,y:160,type:'link',path:'/Applications'}],window:{width:580,height:360}},
  win:{icon:path.resolve('tools/icon.png'),artifactName:'Tracker-CC-${version}-win-${arch}.${ext}'},
  nsis:{artifactName:'Tracker-CC-${version}-win-${arch}.exe',oneClick:false,perMachine:false,allowToChangeInstallationDirectory:true,runAfterFinish:false,createDesktopShortcut:true,createStartMenuShortcut:true,shortcutName:'Tracker C.C.'}};
 fs.writeFileSync('build-config.json',JSON.stringify(config,null,2));
 const builder=args=>run(process.execPath,[require.resolve('electron-builder/cli.js'),'--config','build-config.json',...args,'--publish','never']);
 if(platform==='win'){
  builder(['--win','nsis','--x64']);
  run(process.execPath,['tools/smoke.cjs',path.resolve('dist/win-unpacked/Tracker C.C.exe')]);
 }else{
  builder(['--mac','dir','--x64']);
  const bundle=path.resolve('dist/mac/Tracker C.C.app');
  run(process.execPath,['tools/smoke.cjs',bundle]);
  let valid=0;
  for(const format of ['dmg','zip']){
   const file=path.resolve(`dist/Tracker-CC-${version}-mac-x64.${format}`);
   try{builder(['--mac',format,'--x64','--prepackaged',bundle]);run(format==='dmg'?'/usr/bin/hdiutil':'/usr/bin/unzip',format==='dmg'?['verify',file]:['-tq',file]);valid++;}
   catch(error){fs.rmSync(file,{force:true});fs.rmSync(file+'.blockmap',{force:true});console.error(`${format} failed: ${error.message}`);}
  }
  if(!valid)throw Error('No valid Mac installer.');
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
