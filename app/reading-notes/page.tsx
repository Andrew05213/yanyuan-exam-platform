import type {Metadata} from "next";
import "../literature/literature.css";
import Study from "../literature/study";

export const metadata:Metadata={title:"日本读书笔记 · 和知 AI"};

export default function ReadingNotes(){
  return <Study notebook/>;
}
