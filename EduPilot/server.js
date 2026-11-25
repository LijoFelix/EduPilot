import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createApp } from "./src/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
await mkdir(dataDir, { recursive: true });
const storeFile = path.join(dataDir, "store.json");

const initial = {
  profile: {
    name: "Alex Student",
    level: "Undergraduate",
    subjects: ["DBMS", "Java", "Computer Networks"],
    dailyMinutes: 90,
    goal: "Prepare confidently for upcoming exams",
    learningStyle: "Simple explanations"
  },
  quizHistory: [],
  studyTasks: [
    { id: randomUUID(), subject: "DBMS", topic: "Normalization", minutes: 30, completed: false },
    { id: randomUUID(), subject: "Java", topic: "OOP concepts", minutes: 30, completed: false },
    { id: randomUUID(), subject: "Computer Networks", topic: "OSI model", minutes: 30, completed: false }
  ]
};
if (!existsSync(storeFile)) await writeFile(storeFile, JSON.stringify(initial, null, 2));

const store = {
  async get() { return JSON.parse(await readFile(storeFile, "utf8")); },
  async update(mutator) {
    const data = await this.get();
    const result = await mutator(data);
    await writeFile(storeFile, JSON.stringify(data, null, 2));
    return result ?? data;
  }
};

const app = createApp({ store, root: __dirname });
const port = Number(process.env.PORT || 3000);
createServer(app).listen(port, () => {
  console.log(`EduPilot is running at http://localhost:${port}`);
});
