import {createRoot} from 'react-dom/client';
import Study from './study';
import './literature.css';

const notebook=location.pathname.replace(/\/$/,"")==="/reading-notes";
document.title=notebook?"日本读书笔记 · 博雅怀石":"日本文学研习 · 博雅怀石";
createRoot(document.getElementById('literature-root')!).render(<Study notebook={notebook}/>);
