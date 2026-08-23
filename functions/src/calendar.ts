import { onRequest } from "firebase-functions/v2/https";
import { db } from "./shared";

/* ------------------------------------------------------------------ */
/* 6) 프로젝트 일정 캘린더 구독 피드 (ICS)                                  */
/*    - 구글/애플 캘린더 등에서 "URL로 캘린더 구독"하면 주기적으로 이 URL을     */
/*      다시 불러가 최신 일정을 반영한다. calendarToken으로만 인증한다.        */
/* ------------------------------------------------------------------ */
function escapeICS(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function toICSDate(dateStr: string): string {
  return (dateStr ?? "").replace(/-/g, "");
}

function addOneDayICS(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export const projectCalendarFeed = onRequest({ invoker: "public" }, async (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  const token = req.query.token as string | undefined;
  if (!projectId || !token) {
    res.status(400).send("Bad Request");
    return;
  }

  const projectSnap = await db.collection("projects").doc(projectId).get();
  const project = projectSnap.data();
  if (!projectSnap.exists || !project || project.calendarToken !== token) {
    res.status(403).send("Forbidden");
    return;
  }

  const tasksSnap = await db.collection("tasks").where("projectId", "==", projectId).get();
  const nowStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HANDYWORKS//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICS(`${project.name} 일정 (HANDYWORKS)`)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
  ];

  for (const doc of tasksSnap.docs) {
    const t = doc.data();
    if (!t.startDate || !t.dueDate) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${doc.id}@handyhand.co.kr`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART;VALUE=DATE:${toICSDate(t.startDate)}`,
      `DTEND;VALUE=DATE:${addOneDayICS(t.dueDate)}`,
      `SUMMARY:${escapeICS(`[${project.name}] ${t.name}`)}`,
      ...(t.description ? [`DESCRIPTION:${escapeICS(t.description)}`] : []),
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  res.set("Content-Type", "text/calendar; charset=utf-8");
  res.send(lines.join("\r\n"));
});
