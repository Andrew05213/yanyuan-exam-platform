// All document bytes, fonts and OCR assets stay on this origin.
async function readExamPdf(file, {signal, recognize, progress}) {
 const base='/ocr/pdf/';
 const pdfjs=await import(base+'pdf.js');
 pdfjs.GlobalWorkerOptions.workerSrc=base+'pdf.worker.js';
 signal.throwIfAborted();
 const task=pdfjs.getDocument({
  data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,enableXfa:false,
  useSystemFonts:true,cMapUrl:base+'cmaps/',cMapPacked:true,
  standardFontDataUrl:base+'standard_fonts/',wasmUrl:base+'wasm/',
  maxImageSize:24000000,canvasMaxAreaInBytes:32000000
 });
 const cancel=()=>void task.destroy().catch(()=>{});
 signal.addEventListener('abort',cancel,{once:true});
 try {
  signal.throwIfAborted();
  const pdf=await task.promise;
  if(pdf.numPages>120)throw Error('每次最多识别120页，请拆分 PDF。');
  const pages=[];
  let length=0;
  for(let n=1;n<=pdf.numPages;n++){
   signal.throwIfAborted();
   progress('正在读取第 '+n+' / '+pdf.numPages+' 页');
   const page=await pdf.getPage(n);
   try {
    const content=await page.getTextContent();
    let text='',lastY;
    for(const item of content.items){
     if(typeof item.str!=='string')continue;
     const y=item.transform[5];
     if(lastY!==undefined && Math.abs(y-lastY)>Math.max(2,item.height*.55) && !text.endsWith('\n'))text+='\n';
     text+=item.str+(item.hasEOL?'\n':' ');
     lastY=y;
    }
    // A scanned page can still contain a selectable header or page number.
    const fewWords=text.replace(/\s/g,'').length<80;
    const ops=fewWords?await page.getOperatorList():null;
    if(!text.trim()||ops?.fnArray.some(op=>op===pdfjs.OPS.paintImageXObject||op===pdfjs.OPS.paintInlineImageXObject)){
     progress('正在识别扫描页 '+n+' / '+pdf.numPages);
     const size=page.getViewport({scale:1}),scale=Math.min(2.5,2400/Math.max(size.width,size.height));
     const viewport=page.getViewport({scale});
     const canvas=document.createElement('canvas');
     canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));
     try{
      await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
      signal.throwIfAborted();
      const scanned=await recognize(canvas);
      if(scanned.trim())text=scanned;
     }finally{canvas.width=canvas.height=0;}
    }
    length+=text.length+1;
    if(length>60000)throw Error('识别文字超过60000字，请拆分 PDF。');
    pages.push(text.trim());
   }finally{page.cleanup();}
  }
  return pages;
 }finally{signal.removeEventListener('abort',cancel);await task.destroy();}
}
