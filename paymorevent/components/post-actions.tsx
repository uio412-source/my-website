"use client";
import {useState} from 'react';
export function PostActions({id}:{id:string}){const [error,setError]=useState('');async function remove(){if(!confirm('게시글과 댓글을 삭제할까요?'))return;const r=await fetch('/api/community',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});if(r.ok)location.assign('/#community');else setError((await r.json() as {error?:string}).error??'삭제 실패');}return <div><button className="text-button" onClick={remove}>게시글 삭제</button>{error&&<p role="alert">{error}</p>}</div>;}
