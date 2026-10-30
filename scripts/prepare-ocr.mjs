import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const tessPkg=await fs.realpath(require.resolve('tesseract.js/package.json'));
const tess=path.dirname(tessPkg),childRequire=createRequire(tessPkg);
const core=path.dirname(childRequire.resolve('tesseract.js-core/package.json'));
const out=path.join(root,'public/ocr');
await fs.mkdir(path.join(out,'core'),{recursive:true});
await fs.mkdir(path.join(out,'lang'),{recursive:true});
for(const file of ['tesseract.min.js','worker.min.js','tesseract.min.js.LICENSE.txt','worker.min.js.LICENSE.txt'])await fs.copyFile(path.join(tess,'dist',file),path.join(out,file));
for(const file of await fs.readdir(core))if(/^tesseract-core.*\.wasm(?:\.js)?$/.test(file))await fs.copyFile(path.join(core,file),path.join(out,'core',file));
for(const lang of ['eng','chi_sim']){
  const pkg=path.dirname(require.resolve('@tesseract.js-data/'+lang+'/package.json'));
  await fs.copyFile(path.join(pkg,'4.0.0_best_int',lang+'.traineddata.gz'),path.join(out,'lang',lang+'.traineddata.gz'));
}
for(const [dir,label] of [[tess,'tesseract'],[core,'tesseract-core']]){
  const name=(await fs.readdir(dir)).find(x=>/^LICENSE(?:\.|$)/i.test(x));
  if(name)await fs.copyFile(path.join(dir,name),path.join(out,label+'-LICENSE.txt'));
}
console.log('Prepared self-hosted OCR worker, four core variants and English/Chinese language data.');
