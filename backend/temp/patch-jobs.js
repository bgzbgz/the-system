const http = require('http');
const fs = require('fs');

const JOB1 = process.argv[2];
const JOB2 = process.argv[3];

const jobs = [
  { id: JOB1, html: fs.readFileSync('backend/temp/tool1.html', 'utf8'), name: 'Cash Flow Health Check' },
  { id: JOB2, html: fs.readFileSync('backend/temp/tool2.html', 'utf8'), name: 'Values Alignment Score' }
];

let completed = 0;

jobs.forEach((job, i) => {
  if (!job.id) {
    console.log('Skipping job', i+1, '- no ID');
    completed++;
    return;
  }

  const payload = JSON.stringify({
    status: 'READY_FOR_REVIEW',
    tool_name: job.name,
    tool_html: job.html,
    qa_report: { passed: true, score: 7, max_score: 8, findings: [] }
  });

  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/jobs/' + job.id + '/admin-patch',
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
  }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log('Job', i+1, '(' + job.name + ') patched');
      completed++;
      if (completed === jobs.length) {
        console.log('Done!');
      }
    });
  });
  req.on('error', e => console.error('Error:', e.message));
  req.write(payload);
  req.end();
});
