import type {Metadata} from "next";
import "../literature/literature.css";
import Study from "../literature/study";

export const metadata:Metadata={title:"研究与读书笔记 · 和知 AI"};

export default function ReadingNotes(){
  return <Study notebook/>;
}
