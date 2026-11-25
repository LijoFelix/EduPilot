import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../src/app.js";

function makeStore(){
  let data={profile:{name:"Test Student",level:"Undergraduate",subjects:["DBMS","Java"],dailyMinutes:60,goal:"Learn",learningStyle:"Simple explanations"},quizHistory:[],studyTasks:[]};
  return {async get(){return structuredClone(data);},async update(fn){const copy=structuredClone(data);const result=await fn(copy);data=copy;return result??copy;}};
}
async function withServer(fn){
  const server=http.createServer(createApp({store:makeStore(),root:process.cwd()}));
  await new Promise(r=>server.listen(0,r));
  try{await fn(`http://127.0.0.1:${server.address().port}`);}finally{server.close();}
}
test("health endpoint responds",async()=>withServer(async base=>{
  const r=await fetch(base+"/api/health");assert.equal(r.status,200);assert.equal((await r.json()).ok,true);
}));
test("profile validation rejects missing subjects",async()=>withServer(async base=>{
  const r=await fetch(base+"/api/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"A",subjects:[]})});
  assert.equal(r.status,400);
}));
test("quiz result returns performance advice",async()=>withServer(async base=>{
  const r=await fetch(base+"/api/quizzes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({subject:"DBMS",score:35})});
  const data=await r.json();assert.equal(r.status,201);assert.equal(data.level,"Needs revision");
}));
test("study plan can be generated",async()=>withServer(async base=>{
  const r=await fetch(base+"/api/plan",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
  const data=await r.json();assert.equal(r.status,200);assert.equal(data.length,2);assert.ok(data.every(x=>x.minutes>0));
}));
