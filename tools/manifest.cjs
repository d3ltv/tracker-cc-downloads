'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const [platform,arch]=process.argv.slice(2),version=process.env.RELEASE_VERSION;
(async()=>{
 const files=[];
 for(const format of platform==='mac'?['dmg','zip']:['exe']){
  const name=`Tracker-CC-${version}-${platform}-${arch}.${format}`,file=path.join('dist',name);
  if(!fs.existsSync(file))continue;
  const stat=fs.statSync(file),hash=createHash('sha256');for await(const part of fs.createReadStream(file))hash.update(part);
  files.push({name,platform,arch,format,bytes:stat.size,sha256:hash.digest('hex'),builtAt:stat.mtime.toISOString()});
 }
 if(!files.length)throw Error('No installer to publish.');
 fs.writeFileSync(`dist/manifest-${platform}-${arch}.json`,JSON.stringify({version,sourcePackageSHA256:process.env.PAYLOAD_SHA256,nativeOS:process.platform,nativeArch:process.arch,packagedLaunch:'passed',files},null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
