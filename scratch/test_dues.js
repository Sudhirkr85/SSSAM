const http = require('http');

function post(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = JSON.stringify(data);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function test() {
  try {
    const loginRes = await post('http://localhost:5000/api/auth/login', {
      email: 'admin@gmail.com',
      password: '123456'
    });
    
    if (!loginRes.success) {
      throw new Error(loginRes.message || 'Login failed');
    }
    
    const token = loginRes.data.token;
    console.log('Login successful, token obtained');
    
    const admissionsRes = await get('http://localhost:5000/api/admissions?hasDues=true', token);
    console.log('Admissions response:', JSON.stringify(admissionsRes, null, 2));
  } catch (err) {
    console.error('Request failed:', err.message);
  }
}

test();
