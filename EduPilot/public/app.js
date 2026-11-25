const $ = (s) => document.querySelector(s);
const state = { profile:null, dashboard:null, history:[] };
const api = async (url, options={}) => {
  const response = await fetch(url,{headers:{"Content-Type":"application/json"},...options});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600);}
function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function showView(name){
  document.querySelectorAll(".view").forEach(x=>x.classList.toggle("hidden",x.id!==name));
  document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===name));
  const titles={dashboard:["Good to see you","A little progress each day adds up to big results."],tutor:["Your AI tutor","Curiosity is the beginning of understanding."],planner:["Your study plan","A focused plan makes learning manageable."],quiz:["Practice makes progress","Every attempt helps you learn something new."]};
  $("#page-title").innerHTML=`${titles[name][0]}${name==="dashboard"?", "+esc(state.profile?.name?.split(" ")[0]||"there"):""} <span>✦</span>`;
  $("#page-subtitle").textContent=titles[name][1];
}
function renderProfile(){
  const p=state.profile;$("#side-name").textContent=p.name;$("#top-name").textContent=p.name;$("#avatar").textContent=p.name[0].toUpperCase();document.querySelector(".profile-chip .mini-avatar").textContent=p.name[0].toUpperCase();
  $("#daily-goal").innerHTML=`${p.dailyMinutes} <i>min</i>`;$("#context-summary").textContent=`${p.level} · ${p.learningStyle}`;
  $("#quiz-subject").innerHTML=p.subjects.map(s=>`<option>${esc(s)}</option>`).join("");
}
function renderDashboard(){
  const d=state.dashboard;$("#quiz-count").textContent=d.quizCount;$("#average").textContent=d.quizCount?`${d.average}%`:"—";
  $("#focus-list").innerHTML=d.weakSubjects.length?d.weakSubjects.map(x=>`<div><div class="focus-row"><b>${esc(x.subject)}</b><small>${x.average}% average</small></div><div class="bar"><span style="width:${x.average}%"></span></div></div>`).join(""):`<div class="empty">Complete a quiz to discover your focus areas.</div>`;
  $("#today-list").innerHTML=d.tasks.slice(0,3).map(t=>`<div class="task-row"><span class="task-dot"></span><div><b>${esc(t.subject)}</b><small>${esc(t.topic)} · ${t.minutes} min</small></div></div>`).join("")||`<div class="empty">Generate a study plan to get started.</div>`;
}
function renderPlanner(tasks){$("#planner-list").innerHTML=tasks.map((t,i)=>`<article class="plan-card"><div class="plan-number">${String(i+1).padStart(2,"0")}</div><div class="plan-info"><b>${esc(t.subject)} — ${esc(t.topic)}</b><p>${esc(t.reason||"A focused learning session.")}</p></div><span class="plan-time">${t.minutes} min</span><button class="complete-button ${t.completed?"done":""}" data-task="${t.id}">${t.completed?"✓ Completed":"Mark done"}</button></article>`).join("")||`<div class="empty">No study tasks yet. Generate your plan.</div>`;}
function renderHistory(){
  $("#history-list").innerHTML=state.history.length?[...state.history].reverse().slice(0,12).map(x=>`<div class="history-row"><span><b>${esc(x.subject)}</b><br><small>${esc(x.topic)} · ${new Date(x.date).toLocaleDateString()}</small></span><b>${x.score}%</b></div>`).join(""):`<div class="empty">No quiz results recorded yet.</div>`;
  const recent=state.history.slice(-7);$("#score-chart").innerHTML=recent.length?recent.map(x=>`<div class="chart-col"><b style="font-size:9px">${x.score}%</b><div class="chart-bar" style="height:${Math.max(3,x.score)}%"></div><small>${esc(x.subject.slice(0,7))}</small></div>`).join(""):`<div class="empty">Your score history will appear here.</div>`;
}
async function refresh(){
  const [profile,dashboard,history]=await Promise.all([api("/api/profile"),api("/api/dashboard"),api("/api/quizzes")]);
  state.profile=profile;state.dashboard=dashboard;state.history=history;renderProfile();renderDashboard();renderPlanner(dashboard.tasks);renderHistory();
}
function openProfile(){const p=state.profile;$("#profile-name").value=p.name;$("#profile-level").value=p.level;$("#profile-subjects").value=p.subjects.join(", ");$("#profile-minutes").value=p.dailyMinutes;$("#profile-goal").value=p.goal;$("#profile-style").value=p.learningStyle;$("#profile-dialog").showModal();}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.go)));
$("#edit-profile").addEventListener("click",openProfile);$("#settings").addEventListener("click",openProfile);$("#close-dialog").addEventListener("click",()=>$("#profile-dialog").close());
$("#profile-form").addEventListener("submit",async e=>{
  e.preventDefault();try{const subjects=$("#profile-subjects").value.split(",").map(x=>x.trim()).filter(Boolean);const p=await api("/api/profile",{method:"PUT",body:JSON.stringify({name:$("#profile-name").value,level:$("#profile-level").value,subjects,dailyMinutes:$("#profile-minutes").value,goal:$("#profile-goal").value,learningStyle:$("#profile-style").value})});state.profile=p;$("#profile-dialog").close();await refresh();showView("dashboard");toast("Your learning profile was updated.");}catch(err){toast(err.message);}
});
$("#generate-plan").addEventListener("click",async()=>{try{const tasks=await api("/api/plan",{method:"POST",body:"{}"});renderPlanner(tasks);await refresh();toast("Your personalized plan is ready.");}catch(e){toast(e.message);}});
$("#planner-list").addEventListener("click",async e=>{const b=e.target.closest("[data-task]");if(!b)return;try{await api(`/api/tasks/${b.dataset.task}`,{method:"PATCH",body:"{}"});await refresh();}catch(err){toast(err.message);}});
$("#quiz-score").addEventListener("input",e=>$("#score-output").value=`${e.target.value}%`);
$("#quiz-form").addEventListener("submit",async e=>{
  e.preventDefault();try{const result=await api("/api/quizzes",{method:"POST",body:JSON.stringify({subject:$("#quiz-subject").value,topic:$("#quiz-topic").value||"General",score:$("#quiz-score").value})});$("#quiz-feedback").classList.remove("hidden");$("#quiz-feedback").innerHTML=`<b>${result.level} · ${result.score}%</b><br>${esc(result.advice)}<br><b>Next step:</b> ${esc(result.next)}`;await refresh();toast("Quiz result saved. Your learning insights are updated.");}catch(err){toast(err.message);}
});
function addMessage(text,role){const node=document.createElement("div");node.className=`message ${role}`;if(role==="assistant"){const avatar=document.createElement("span");avatar.className="bot-avatar";avatar.textContent="✦";node.append(avatar);}const content=document.createElement("div");const p=document.createElement("p");p.textContent=text;content.append(p);node.append(content);$("#messages").append(node);$("#messages").scrollTop=$("#messages").scrollHeight;return node;}
async function sendQuestion(question){
  addMessage(question,"user");const pending=addMessage("Thinking through your question...","assistant");
  try{const result=await api("/api/chat",{method:"POST",body:JSON.stringify({question})});pending.querySelector("p").textContent=result.answer;$("#chat-mode").textContent=result.mode==="ai"?"AI-powered · Context aware":"Demo mode · Add Gemini API key for live AI";}catch(e){pending.querySelector("p").textContent=e.message;}
}
$("#chat-form").addEventListener("submit",e=>{e.preventDefault();const input=$("#question");const q=input.value.trim();if(!q)return;input.value="";sendQuestion(q);});
document.querySelectorAll(".suggestion").forEach(b=>b.addEventListener("click",()=>sendQuestion(b.textContent)));
$("#today").textContent=new Date().toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"});
try{await refresh();showView("dashboard");}catch(e){toast("Could not load EduPilot. Please refresh.");}
