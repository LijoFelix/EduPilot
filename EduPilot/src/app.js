import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIME = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript", ".json":"application/json", ".svg":"image/svg+xml" };

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}
async function body(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error("Request too large");
  }
  return raw ? JSON.parse(raw) : {};
}
function scoreAdvice(score) {
  if (score < 50) return { level:"Needs revision", advice:"Review the fundamentals, read a simpler explanation, then retry a short quiz.", next:"Revise the basics" };
  if (score < 80) return { level:"Making progress", advice:"You understand the foundations. Practise the topics you missed and try another quiz.", next:"Practise weak areas" };
  return { level:"Strong performance", advice:"Great work. Try an advanced question or move to the next topic.", next:"Try advanced practice" };
}
function weakSubjects(history) {
  const map = {};
  for (const q of history) {
    map[q.subject] ??= { total:0, count:0 };
    map[q.subject].total += q.score;
    map[q.subject].count++;
  }
  return Object.entries(map).map(([subject,v]) => ({ subject, average:Math.round(v.total/v.count) })).sort((a,b)=>a.average-b.average);
}
function makePlan(profile, history) {
  const subjects = profile.subjects?.length ? profile.subjects : ["General studies"];
  const weak = weakSubjects(history);
  const ordered = [...subjects].sort((a,b) => {
    const av = weak.find(x=>x.subject===a)?.average ?? 60;
    const bv = weak.find(x=>x.subject===b)?.average ?? 60;
    return av-bv;
  });
  const total = Math.max(30, Number(profile.dailyMinutes) || 60);
  const slot = Math.max(15, Math.floor(total/ordered.length/5)*5);
  return ordered.map((subject,i)=>({
    id: randomUUID(), subject,
    topic: weak.find(x=>x.subject===subject)?.average < 50 ? "Revise fundamentals" : "Learn and practise a key topic",
    minutes: i===ordered.length-1 ? Math.max(15,total-slot*(ordered.length-1)) : slot,
    reason: weak.find(x=>x.subject===subject)?.average < 50 ? "Prioritized because recent quiz performance is low." : "Balanced practice based on your selected subjects.",
    completed:false
  }));
}
async function askGemini(question, profile, history) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const context = `Student level: ${profile.level}. Learning preference: ${profile.learningStyle}. Subjects: ${(profile.subjects||[]).join(", ")}. Recent quiz results: ${history.slice(-5).map(x=>`${x.subject} ${x.score}%`).join("; ") || "No quiz history"}.`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ contents:[{parts:[{text:`You are EduPilot, a supportive educational tutor. Adapt to the student context. Explain clearly, use examples, and do not simply give answers to graded work. ${context}\nStudent question: ${question}`}]}], generationConfig:{temperature:0.5, maxOutputTokens:700} })
  });
  if (!response.ok) throw new Error("AI provider request failed");
  const json = await response.json();
  return json.candidates?.[0]?.content?.parts?.map(p=>p.text).join("\n") || "I couldn't create an answer. Please try again.";
}
export function createApp({ store, root }) {
  return async function handler(req,res) {
    const url = new URL(req.url, "http://localhost");
    const route = url.pathname;
    try {
      if (req.method === "GET" && route === "/api/health") return send(res,200,{ ok:true, app:"EduPilot" });
      if (route.startsWith("/api/")) {
        const data = await store.get();
        if (req.method === "GET" && route === "/api/dashboard") {
          const weak = weakSubjects(data.quizHistory);
          const average = data.quizHistory.length ? Math.round(data.quizHistory.reduce((s,x)=>s+x.score,0)/data.quizHistory.length) : 0;
          return send(res,200,{ profile:data.profile, quizCount:data.quizHistory.length, average, weakSubjects:weak, tasks:data.studyTasks });
        }
        if (req.method === "GET" && route === "/api/profile") return send(res,200,data.profile);
        if (req.method === "PUT" && route === "/api/profile") {
          const input = await body(req);
          if (!input.name?.trim() || !Array.isArray(input.subjects) || !input.subjects.length) return send(res,400,{error:"Name and at least one subject are required."});
          const profile = { name:input.name.trim().slice(0,80), level:String(input.level||"Undergraduate"), subjects:input.subjects.map(x=>String(x).slice(0,50)).slice(0,12), dailyMinutes:Math.min(600,Math.max(15,Number(input.dailyMinutes)||60)), goal:String(input.goal||"Improve learning").slice(0,200), learningStyle:String(input.learningStyle||"Simple explanations") };
          await store.update(d=>{d.profile=profile;});
          return send(res,200,profile);
        }
        if (req.method === "GET" && route === "/api/quizzes") return send(res,200,data.quizHistory);
        if (req.method === "POST" && route === "/api/quizzes") {
          const input = await body(req);
          const score = Number(input.score);
          if (!Number.isFinite(score) || score<0 || score>100 || !input.subject) return send(res,400,{error:"Provide a subject and a score from 0 to 100."});
          const item = { id:randomUUID(), subject:String(input.subject).slice(0,50), topic:String(input.topic||"General").slice(0,80), score:Math.round(score), date:new Date().toISOString() };
          await store.update(d=>{d.quizHistory.push(item);});
          return send(res,201,{...item, ...scoreAdvice(item.score)});
        }
        if (req.method === "POST" && route === "/api/plan") {
          const plan = makePlan(data.profile,data.quizHistory);
          await store.update(d=>{d.studyTasks=plan;});
          return send(res,200,plan);
        }
        if (req.method === "PATCH" && route.startsWith("/api/tasks/")) {
          const id = route.split("/").pop();
          const result = await store.update(d=>{
            const task=d.studyTasks.find(x=>x.id===id);
            if (!task) return null;
            task.completed=Boolean(!task.completed);
            return task;
          });
          return result ? send(res,200,result) : send(res,404,{error:"Task not found."});
        }
        if (req.method === "POST" && route === "/api/chat") {
          const input=await body(req);
          const question=String(input.question||"").trim();
          if (!question || question.length>1500) return send(res,400,{error:"Enter a question (maximum 1500 characters)."});
          let answer;
          try { answer=await askGemini(question,data.profile,data.quizHistory); }
          catch { return send(res,502,{error:"The AI service is temporarily unavailable. Please try again later."}); }
          if (!answer) answer=`Let's break this down simply, ${data.profile.name}.\\n\\nStart by identifying the main idea in your question: "${question}".\\n\\n1. Learn the definition and purpose.\\n2. Work through one small example.\\n3. Explain the idea in your own words.\\n4. Test yourself with a practice question.\\n\\nThis is demo mode. Add GEMINI_API_KEY in your environment to enable personalized AI-generated answers.`;
          return send(res,200,{answer,mode:process.env.GEMINI_API_KEY?"ai":"demo"});
        }
        return send(res,404,{error:"API route not found."});
      }
      const relative = route === "/" ? "index.html" : decodeURIComponent(route.slice(1));
      const file = path.resolve(root,"public",relative);
      if (!file.startsWith(path.resolve(root,"public")+path.sep)) return send(res,403,{error:"Forbidden"});
      try {
        const content=await readFile(file);
        res.writeHead(200,{"Content-Type":MIME[path.extname(file)]||"application/octet-stream"});
        res.end(content);
      } catch { res.writeHead(404,{"Content-Type":"text/plain"}); res.end("Not found"); }
    } catch (error) {
      send(res,500,{error:"Something went wrong. Please try again."});
    }
  };
}
