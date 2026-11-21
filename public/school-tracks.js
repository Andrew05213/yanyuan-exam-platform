'use strict';
const SchoolTracks={
 choices:{},
 language(id){const school=Hub.schoolById(id),chosen=this.choices[id];return school.languageIds.includes(chosen)?chosen:school.defaultLanguageId;},
 pendingNote(){return '<p class="notice">考试标准待补充；当前开放通用练习，题型、题量与限时不代表正式校测。</p>';},
 selector(id){
  const school=Hub.schoolById(id),e=Hub.e;
  return '<div class="school-language-filter"><label>目标语种<select data-school-language="'+e(id)+'">'+school.languageIds.map(key=>'<option value="'+e(key)+'" '+(key===this.language(id)?'selected':'')+'>'+e(Hub.data.languages[key].label)+'</option>').join('')+'</select></label><details class="language-policy"><summary>招生语种与训练范围</summary><p>'+e(school.languagePolicy.note)+'</p><p>2026 历史参考；2027 以当年简章为准。 <a class="text-link" href="'+e(Hub.safeUrl(school.languagePolicy.sourceUrl))+'" target="_blank" rel="noopener">查看来源</a></p></details></div>';
 },
 decorateSchool(school){
  const lang=this.language(school.id),pool=HubEngine.oralPool(Hub.data,school.id,lang),country=pool.filter(q=>q.countryLanguageId),e=Hub.e;
  const heading=document.querySelector('.school-masthead');if(heading)heading.insertAdjacentHTML('beforeend',this.selector(school.id));
  if(school.examStandardStatus==='pending')heading?.insertAdjacentHTML('afterend',this.pendingNote());
  const recipe=HubEngine.oralRecipe(Hub.data,school.id,lang),recipeBox=document.querySelector('.hub-recipe');
  if(recipeBox)recipeBox.innerHTML=recipe.map((type,i)=>'<div><span class="recipe-step">'+String(i+1).padStart(2,'0')+'</span><div><b>'+e(Hub.data.types[type]||Hub.data.languages[lang].label+'国别')+'</b><span>'+pool.filter(q=>q.type===type).length+' 项可选</span></div></div>').join('');
  document.querySelectorAll('.school-combo [data-hub="school-oral"],.school-combo + .section-top [data-hub="school-oral"]').forEach(b=>b.textContent='查看 '+pool.length+' 项任务');
  const note=document.querySelector('.school-combo .section-top p');if(note)note.textContent=recipe.map(type=>Hub.data.types[type]||Hub.data.languages[lang].label+'国别').join(' → ')+'；各抽一项。';
  const grid=document.querySelector('.school-combo + .section-top + .hub-task-grid')||document.querySelector('#screen > .hub-task-grid');
  if(grid)grid.innerHTML=(country.length?country:pool).slice(0,6).map(q=>Hub.taskCard(q,school.id)).join('');
  if(!country.length&&recipe.some(type=>!pool.some(q=>q.type===type)))document.querySelector('.school-combo')?.insertAdjacentHTML('beforeend','<p class="hub-form-note">该语种国别题待补充；可先练习已有的朗读、演讲等专项，整场组合将明确提示库存不足。</p>');
 },
 decorateStudio(){
  const heading=document.querySelector('#screen .page-heading');if(!heading)return;
  document.querySelector('#school-training-language')?.remove();
  heading.insertAdjacentHTML('afterend','<div id="school-training-language" class="training-language">'+this.selector(Hub.school)+(Hub.schoolById(Hub.school).examStandardStatus==='pending'?this.pendingNote():'')+'</div>');
 },
 init(){
  try{const saved=JSON.parse(localStorage.getItem('yanyuan-language:'+encodeURIComponent(PublicApp.session.userId||'guest'))||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))this.choices=saved;}catch{}
  if(new URLSearchParams(location.search).get("readingPractice")==="ja"&&location.hash.startsWith("#task/pku/jp-"))this.choices.pku="ja";
  const school=Hub.renderSchool.bind(Hub);Hub.renderSchool=s=>{school(s);this.decorateSchool(s);};
  const oral=Hub.renderOralBank.bind(Hub);Hub.renderOralBank=()=>{oral();document.querySelector('#screen .page-heading')?.insertAdjacentHTML('afterend',this.selector(Hub.school));};
  const studio=TierStudio.render.bind(TierStudio);TierStudio.render=()=>{studio();this.decorateStudio();};
  const fields=Hub.studioFields.bind(Hub);Hub.studioFields=()=>{fields();document.querySelector('#school-studio-language')?.remove();document.querySelector('#hub-dynamic-fields')?.insertAdjacentHTML('beforebegin','<div id="school-studio-language">'+this.selector(Hub.school)+(Hub.schoolById(Hub.school).examStandardStatus==='pending'?this.pendingNote():'')+'</div>');};
  const recipe=Hub.oralFields.bind(Hub);Hub.oralFields=()=>{recipe();const type=document.querySelector('#hub-type')?.value,pool=HubEngine.oralPool(Hub.data,Hub.school,this.language(Hub.school));const note=document.querySelector('#hub-pool-info');if(note)note.textContent=type==='session'?HubEngine.oralRecipe(Hub.data,Hub.school,this.language(Hub.school)).map(t=>Hub.data.types[t]||'目标语种国别（待补充）').join(' → ')+'；各抽一项。':'当前语种有 '+pool.filter(q=>q.type===type).length+' 项，筛选层级后可能减少。';};
  document.querySelector('#screen').addEventListener('change',event=>{
   const el=event.target;if(el.id==='hub-oral-school'){Hub.renderOralBank();return;}if(!el.dataset.schoolLanguage)return;
   const id=el.dataset.schoolLanguage;if(!Hub.schoolById(id).languageIds.includes(el.value))return;this.choices[id]=el.value;
   try{localStorage.setItem('yanyuan-language:'+encodeURIComponent(PublicApp.session.userId||'guest'),JSON.stringify(this.choices));}catch{}
   if(location.hash.startsWith('#school/'))Hub.renderSchool(Hub.schoolById(id));else if(currentView==='oral')Hub.renderOralBank();else if(document.querySelector('#hub-mode'))Hub.studioFields();else TierStudio.render();
  });
 }
};

