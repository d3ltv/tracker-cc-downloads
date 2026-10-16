'use strict';
const {_electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const pkg=require('../app/package.json'),productName='Tracker C.C';
async function main(){
 const supplied=process.argv[2];
 if(!supplied)throw new Error('Indique le chemin de l’application empaquetée.');
 const target=path.resolve(supplied),mac=target.endsWith('.app');
 if(mac)execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',target],{stdio:'inherit'});
 const executable=mac?path.join(target,'Contents','MacOS',productName):target;
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'tracker-release-smoke-'));
 let app;
 const errors=[];
 try{
  app=await _electron.launch({executablePath:executable,args:[`--user-data-dir=${directory}`],timeout:45000});
  const page=await app.firstWindow();
  page.on('pageerror',e=>errors.push(e.message));
  await page.waitForFunction(()=>window.appReady,{},{timeout:30000});
  const info=await app.evaluate(({app})=>({packaged:app.isPackaged,version:app.getVersion(),data:app.getPath('userData'),platform:process.platform,arch:process.arch,zipExport:typeof process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json')('./src/audio-export.js').exportArchive}));
  assert.equal(info.zipExport,'function');assert.equal(info.packaged,true);assert.equal(info.version,pkg.version);assert.equal(path.resolve(info.data),path.resolve(directory));
  assert.equal(await page.locator('#start-session').isVisible(),true);
  await page.locator('#start-session').click();
  await page.locator('#pause-session').waitFor({state:'visible'});
  await page.locator('#pause-session').click();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'passed',...info,data:'temporary isolated directory',executable},null,2));
 }finally{if(app)await app.close();fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
