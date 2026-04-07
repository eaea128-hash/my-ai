const res = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name,
    desc,
    style,
    strategy6R: r6,
    complianceLevel: compliance,
    budget
  })
});

if (!res.ok) {
  const err = await res.json();
  throw new Error(err.error || `HTTP ${res.status}`);
}

const data = await res.json();
let d = data.result;  // 後端包在 result 裡
