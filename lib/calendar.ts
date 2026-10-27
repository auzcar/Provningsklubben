// Calendar files (iCalendar, RFC 5545) for tastings: one event to download, or a whole feed
// that calendar apps subscribe to (app/api/calendar). With a start time the event is timed in
// Swedish time; without one it is an all-day event.
export type CalendarTasting={id:string;title:string;date:string;time?:string;endTime?:string;location?:string;theme?:string;host?:string;version?:number};
const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/[,;]/g,m=>'\\'+m).replace(/\r?\n/g,'\\n');
const ymd=(d:Date)=>d.toISOString().slice(0,10).replace(/-/g,'');
const stamp=()=>new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
const TZ='Europe/Stockholm';
// Central European time with the EU summer-time rule, so clients without their own zone data agree.
const VTIMEZONE=['BEGIN:VTIMEZONE',`TZID:${TZ}`,
 'BEGIN:DAYLIGHT','TZOFFSETFROM:+0100','TZOFFSETTO:+0200','TZNAME:CEST','DTSTART:19700329T020000','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU','END:DAYLIGHT',
 'BEGIN:STANDARD','TZOFFSETFROM:+0200','TZOFFSETTO:+0100','TZNAME:CET','DTSTART:19701025T030000','RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU','END:STANDARD',
 'END:VTIMEZONE'];
// Lines longer than 75 bytes are folded, without splitting a UTF-8 character.
function fold(line:string){
 const out:string[]=[];let cur='',bytes=0;
 for(const ch of line){const n=new TextEncoder().encode(ch).length;if(bytes+n>(out.length?74:75)){out.push(cur);cur='';bytes=0;}cur+=ch;bytes+=n;}
 out.push(cur);return out.join('\r\n ');
}
// Wall-clock arithmetic on a local date and time, done in UTC so no time zone shifts it.
function local(date:string,time:string,addMinutes=0){
 const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number);
 const t=new Date(Date.UTC(y,m-1,d,h,min+addMinutes));
 return t.toISOString().slice(0,16).replace(/[-:]/g,'')+'00';
}
export function tastingEvent(t:CalendarTasting,url:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(t.date))return [];
 let when:string[];
 if(t.time&&/^\d{2}:\d{2}$/.test(t.time)){
  const mins=(x:string)=>Number(x.slice(0,2))*60+Number(x.slice(3,5));
  // Without an end time the evening is booked for three hours; an end before the start means after midnight.
  const length=t.endTime&&/^\d{2}:\d{2}$/.test(t.endTime)?((mins(t.endTime)-mins(t.time)+1440)%1440||1440):180;
  when=[`DTSTART;TZID=${TZ}:${local(t.date,t.time)}`,`DTEND;TZID=${TZ}:${local(t.date,t.time,length)}`];
 }else{const start=new Date(t.date+'T00:00:00Z');when=[`DTSTART;VALUE=DATE:${ymd(start)}`,`DTEND;VALUE=DATE:${ymd(new Date(start.getTime()+864e5))}`];}
 return ['BEGIN:VEVENT',`UID:${t.id}@provningsklubben`,`DTSTAMP:${stamp()}`,`SEQUENCE:${t.version||0}`,...when,
  `SUMMARY:${esc('Provningsklubben: '+t.title)}`,...(t.location?[`LOCATION:${esc(t.location)}`]:[]),
  `DESCRIPTION:${esc([t.theme&&'Tema: '+t.theme,t.host&&'Värd: '+t.host,url].filter(Boolean).join('\n'))}`,`URL:${url}`,'END:VEVENT'];
}
function wrap(events:string[][],extra:string[]=[]){
 const timed=events.some(e=>e.some(l=>l.startsWith('DTSTART;TZID')));
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Provningsklubben//SV','CALSCALE:GREGORIAN',...extra,...(timed?VTIMEZONE:[]),...events.flat(),'END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
export function tastingIcs(t:CalendarTasting,url:string){return wrap([tastingEvent(t,url)],['METHOD:PUBLISH']);}
// A subscribed feed; calendar apps refresh it on their own schedule (often every few hours).
export function tastingFeed(tastings:{t:CalendarTasting;url:string}[]){
 return wrap(tastings.map(x=>tastingEvent(x.t,x.url)).filter(e=>e.length),['METHOD:PUBLISH','X-WR-CALNAME:Provningsklubben',`X-WR-TIMEZONE:${TZ}`,'REFRESH-INTERVAL;VALUE=DURATION:PT1H','X-PUBLISHED-TTL:PT1H']);
}
