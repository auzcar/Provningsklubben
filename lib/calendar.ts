// A one-event calendar file (iCalendar, RFC 5545) for a tasting date, as an all-day event.
const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/[,;]/g,m=>'\\'+m).replace(/\r?\n/g,'\\n');
const day=(d:Date)=>d.toISOString().slice(0,10).replace(/-/g,'');
export function tastingIcs(t:{id:string;title:string;date:string;theme?:string},url:string){
 const start=new Date(t.date+'T00:00:00Z'),end=new Date(start.getTime()+864e5);
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Provningsklubben//SV','CALSCALE:GREGORIAN','BEGIN:VEVENT',
  `UID:${t.id}@provningsklubben`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').slice(0,15)}Z`,
  `DTSTART;VALUE=DATE:${day(start)}`,`DTEND;VALUE=DATE:${day(end)}`,`SUMMARY:${esc('Provningsklubben: '+t.title)}`,
  `DESCRIPTION:${esc([t.theme,url].filter(Boolean).join('\n'))}`,`URL:${url}`,'END:VEVENT','END:VCALENDAR'].join('\r\n')+'\r\n';
}
