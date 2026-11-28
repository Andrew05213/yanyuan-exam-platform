import {createRoot} from 'react-dom/client';
import Study from './study';
import './literature.css';

const notebook=location.pathname.replace(/\/$/,"")==="/reading-notes";
document.title=notebook?"研究与读书笔记 · 和知 AI":"全球文学研习 · 和知 AI";
createRoot(document.getElementById('literature-root')!).render(<Study notebook={notebook}/>);
