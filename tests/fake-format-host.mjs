import { writeFileSync } from 'node:fs';
writeFileSync(process.env.ASTELVO_TEST_PID_FILE,String(process.pid));
// Deliberately ignore requests and SIGTERM: supervisor must observe forceful exit.
process.on('SIGTERM',()=>{}); process.stdin.resume(); setInterval(()=>{},1000);
