async function loadToday() {
  const section=document.querySelector('#today'), tasks=section.querySelector('ul'), summary=section.querySelector('p');
  try {
    const response=await fetch('/api/today',{cache:'no-store'});
    if(!response.ok) throw Error();
    const data=await response.json();
    tasks.replaceChildren();
    function link(label,href) {
      const li=document.createElement('li'), a=document.createElement('a');
      a.textContent=label; a.href=href; li.append(a); tasks.append(li);
    }
    for(const m of data.mistakes.slice(0,3)) link('重做 · '+m.title,'/training.html#redo/'+encodeURIComponent(m.id));
    for(const n of data.notes.slice(0,3)) link('复习笔记 · '+n.title,'/literature#note/'+encodeURIComponent(n.id));
    if(data.packet) link('继续笔试 · '+data.packet.title,'/training.html#packet/'+encodeURIComponent(data.packet.id));
    if(data.recent) link('最近编辑 · '+data.recent.title,'/literature#note/'+encodeURIComponent(data.recent.id));
    summary.textContent='今日到期 '+data.mistakes.length+' 组错题、'+data.notes.length+' 篇笔记。近七天保存或更新了 '+data.week.practice+' 份作答、'+data.week.review+' 份错题重做、'+data.week.notes+' 篇笔记（含 '+data.week.oral+' 篇口试复练）。';
    if(!tasks.children.length) link('开始一组训练','/training.html#studio');
  } catch {
    summary.textContent='今日记录暂时无法读取。';
    const retry=document.createElement('button'); retry.textContent='重新读取'; retry.onclick=loadToday; tasks.replaceChildren(retry);
  }
}
loadToday();
