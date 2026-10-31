import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
const require=createRequire(import.meta.url);
const root=fileURLToPath(new URL('../',import.meta.url));
const tessPkg=await fs.realpath(require.resolve('tesseract.js/package.json'));
const tess=path.dirname(tessPkg),childRequire=createRequire(tessPkg);
const core=path.dirname(childRequire.resolve('tesseract.js-core/package.json'));
const out=path.join(root,'public/ocr');
await fs.mkdir(path.join(out,'core'),{recursive:true});
await fs.mkdir(path.join(out,'lang'),{recursive:true});
await fs.mkdir(path.join(out,'data'),{recursive:true});
for(const file of ['tesseract.min.js','worker.min.js','tesseract.min.js.LICENSE.txt','worker.min.js.LICENSE.txt'])await fs.copyFile(path.join(tess,'dist',file),path.join(out,file));
for(const file of await fs.readdir(core))if(/^tesseract-core.*\.wasm(?:\.js)?$/.test(file))await fs.copyFile(path.join(core,file),path.join(out,'core',file));
for(const lang of ['eng','chi_sim']){
  const pkg=path.dirname(require.resolve('@tesseract.js-data/'+lang+'/package.json'));
  await fs.copyFile(path.join(pkg,'4.0.0_best_int',lang+'.traineddata.gz'),path.join(out,'lang',lang+'.traineddata.gz'));
  // Serve raw model data as well: some local servers treat .gz as HTTP encoding.
  const data=gunzipSync(await fs.readFile(path.join(pkg,'4.0.0_best_int',lang+'.traineddata.gz')));
  if(data.length<1024)throw Error('OCR language data is incomplete: '+lang);
  await fs.writeFile(path.join(out,'data',lang+'.traineddata'),data);
}
for(const [dir,label] of [[tess,'tesseract'],[core,'tesseract-core']]){
  const name=(await fs.readdir(dir)).find(x=>/^LICENSE(?:\.|$)/i.test(x));
  if(name)await fs.copyFile(path.join(dir,name),path.join(out,label+'-LICENSE.txt'));
}
console.log('Prepared self-hosted OCR worker, four core variants and English/Chinese language data.');
