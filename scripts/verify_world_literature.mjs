import assert from 'node:assert/strict';
import {worldWorks,literatureLanguages,searchLiterature,metadataFor,validLiteraryMetadata} from '../app/literature/world-literature.ts';
assert.equal(new Set(worldWorks.map(w=>w.id)).size,worldWorks.length);
for(const l of literatureLanguages.filter(l=>l.id!=='ja'&&!['unknown','other'].includes(l.id)))assert.ok(searchLiterature(worldWorks,{language:l.id}).length>0,l.id);
for(const [query,id] of [['HAMLET','world_en-hamlet'],['Goethe Faust','world_de-faust'],['Flaubert','world_fr-madame'],['L’Etranger','world_fr-etranger'],['Преступление','world_ru-crime'],['춘향전','world_ko-chunhyang'],['百年孤独','world_es-soledad']]){
 assert.ok(searchLiterature(worldWorks,{query}).some(w=>w.id===id),query);
}
assert.equal(searchLiterature(worldWorks,{language:'de',query:'Hamlet'}).length,0);
assert.deepEqual(searchLiterature(worldWorks,{genre:'戏剧',language:'fr'}).map(w=>w.id),['world_fr-tartuffe']);
assert.equal(metadataFor({id:'material_test'}).languageId,'unknown');
assert.equal(metadataFor({id:'genji'},{languageId:'ja'}).languageId,'ja');
assert.equal(validLiteraryMetadata({languageId:'bogus'}),false);
assert.equal(validLiteraryMetadata({originalTitle:'x'.repeat(201)}),false);
for(const w of worldWorks)assert.ok(validLiteraryMetadata(w));
console.log('PASS: global literature language, genre and multilingual title/author search; legacy metadata and invalid fields.');
