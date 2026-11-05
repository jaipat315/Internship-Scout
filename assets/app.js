(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const STORAGE = 'scout_uga_v1';
  const today = () => new Date().toISOString().slice(0, 10);
  const emptyState = { saved: [], tracking: {}, notes: {}, custom: [] };
  let local = { ...emptyState };
  try { const saved = JSON.parse(localStorage.getItem(STORAGE) || '{}'); local = { ...emptyState, ...saved }; } catch (_) {}
  local.saved = Array.isArray(local.saved) ? local.saved : [];
  local.custom = Array.isArray(local.custom) ? local.custom : [];
  local.tracking = local.tracking && typeof local.tracking === 'object' ? local.tracking : {};
  local.notes = local.notes && typeof local.notes === 'object' ? local.notes : {};
  const persist = () => { try { localStorage.setItem(STORAGE, JSON.stringify(local)); } catch (_) {} };
  let feed = window.SCOUT_DATA || { jobs: [], updated_at: null };
  let digest = { added_ids: [], errors: [], message: 'Weekly scan not run yet.' };
  let view = 'all';
  let notesId = null;

  const escaped = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const secureUrl = v => { try { const u = new URL(String(v)); return ['https:','http:'].includes(u.protocol) ? u.href : ''; } catch (_) { return ''; } };
  const getJobs = () => [...(feed.jobs || []), ...local.custom].filter(j => j && j.id && j.title && j.company);
  const dateFormat = s => { if (!s) return 'Not listed'; const d = new Date(s.includes('T') ? s : `${s}T12:00:00`); return Number.isNaN(+d) ? 'Not listed' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
  const daysSince = s => { if (!s) return Infinity; const d = Date.parse(s); return Number.isNaN(d) ? Infinity : Math.floor((Date.now() - d) / 86400000); };
  const isFresh = j => daysSince(j.first_seen) >= 0 && daysSince(j.first_seen) < 7;
  const getArea = j => j.area || (/(athens|watkinsville|bogart)/i.test(j.location) ? 'Athens' : /(atlanta|alpharetta|brookhaven|sandy springs|marietta|conyers|roswell|dunwoody|peachtree|norcross|duluth|decatur|smyrna|college park)/i.test(j.location) ? 'Atlanta' : /remote/i.test(j.location) ? 'Remote' : 'Nationwide');
  const hasApplied = id => ['applied','interview','offer','rejected'].includes(local.tracking[id]);
  const score = j => {
    const cat = String(j.category || '');
    let value = ({ Wealth: 110, Investment: 105, Finance: 100, Accounting: 90, Strategy: 80, Analytics: 75, Consulting: 72, Operations: 65, Marketing: 55, Other: 30 })[cat] || 40;
    value += ({ confirmed: 35, possible: 12, unknown: 0, ineligible: -50 })[j.eligibility] || 0;
    if (getArea(j) === 'Atlanta') value += 20;
    if (getArea(j) === 'Athens') value += 25;
    if (j.season === 'Summer 2027') value += 12;
    if (j.season === 'Summer 2028' && ['Wealth','Investment'].includes(cat)) value += 11;
    if (j.status === 'live-feed') value += 10;
    return value;
  };
  const labelForEligibility = j => {
    if (j.eligibility === 'confirmed') return ['2029 fit confirmed','eligible'];
    if (j.eligibility === 'possible') return ['Possible 2029 fit','possible'];
    if (j.eligibility === 'ineligible') return ['Likely ineligible','check'];
    return ['Check class-year fit','check'];
  };
  function activeJobs() {
    let arr = getJobs();
    const q = $('#search').value.trim().toLowerCase();
    const area = $('#area').value;
    const category = $('#category').value;
    const eligibility = $('#eligibility').value;
    if (q) arr = arr.filter(j => [j.title, j.company, j.location, j.category, j.season, j.eligibility_note].some(v => String(v || '').toLowerCase().includes(q)));
    if (area !== 'all') arr = arr.filter(j => getArea(j) === area);
    if (category !== 'all') arr = arr.filter(j => j.category === category);
    if (eligibility !== 'all') arr = arr.filter(j => j.eligibility === eligibility);
    if (view === 'new') arr = arr.filter(isFresh);
    if (view === 'saved') arr = arr.filter(j => local.saved.includes(j.id));
    if (view === 'applied') arr = arr.filter(j => local.tracking[j.id] && local.tracking[j.id] !== 'none');
    const order = $('#sort').value;
    if (order === 'company') arr.sort((a,b) => a.company.localeCompare(b.company));
    else if (order === 'newest') arr.sort((a,b) => (b.first_seen || '').localeCompare(a.first_seen || '') || score(b) - score(a));
    else arr.sort((a,b) => score(b)-score(a) || a.company.localeCompare(b.company));
    return arr;
  }
  function renderCard(j) {
    const [label, type] = labelForEligibility(j);
    const saved = local.saved.includes(j.id);
    const name = escaped(j.company);
    const title = escaped(j.title);
    const source = escaped(j.source || 'User added');
    const url = secureUrl(j.url);
    const initial = String(j.company).split(/\s+/).slice(0, 2).map(s => s[0] || '').join('').slice(0, 2).toUpperCase();
    const tones = ['blue','purple','tan','green'];
    const tone = tones[([...j.company].reduce((a,c)=>a+c.charCodeAt(0),0))%4];
    const status = local.tracking[j.id] || 'none';
    const sel = (v) => status === v ? ' selected' : '';
    return `<article class="job-card">
      <div class="job-top"><div class="company-mark" data-tone="${tone}">${escaped(initial)}</div><div class="job-head"><div class="job-company">${name}</div><h3 class="job-title">${title}</h3></div><button class="save-btn ${saved ? 'is-saved' : ''}" data-action="save" data-id="${escaped(j.id)}" aria-label="${saved ? 'Remove bookmark' : 'Bookmark'} ${title}" title="${saved ? 'Remove bookmark' : 'Save listing'}">${saved ? '♥' : '♡'}</button></div>
      <div class="job-meta"><span>${escaped(j.location || 'Location unlisted')}</span><span>${escaped(j.season || 'Date unknown')}</span></div>
      <div class="tagline"><span class="tag ${type}">${escaped(label)}</span><span class="tag">${escaped(j.category || 'Other')}</span>${j.status === 'live-feed' ? '<span class="tag eligible">Employer feed</span>' : ''}${isFresh(j) ? '<span class="tag status">New to Scout</span>' : ''}</div>
      <p class="job-note">${escaped(j.eligibility_note || 'Confirm class standing, timing, and eligibility on the application.')} ${j.deadline ? 'Deadline: ' + escaped(dateFormat(j.deadline)) + '.' : ''}</p>
      <div class="job-bottom"><div><a href="${escaped(url || '#')}" target="_blank" rel="noopener noreferrer" ${!url?'aria-disabled="true"':''}>${url ? 'View listing ↗' : 'No direct link'}</a><div class="job-source-label" style="font-size:9px;margin-top:4px">${source}${j.salary ? ' · ' + escaped(j.salary) : ''}</div></div><div class="track-tools"><button class="notes-btn" data-action="notes" data-id="${escaped(j.id)}" title="Application notes">Notes</button><select aria-label="Application status for ${title}" data-status-id="${escaped(j.id)}"><option value="none"${sel('none')}>Not started</option><option value="planning"${sel('planning')}>Planning</option><option value="applied"${sel('applied')}>Applied</option><option value="interview"${sel('interview')}>Interview</option><option value="offer"${sel('offer')}>Offer</option><option value="rejected"${sel('rejected')}>Closed out</option></select>${j.status === 'manual' ? `<button class="custom-delete" title="Delete custom listing" data-action="delete" data-id="${escaped(j.id)}">✕</button>` : ''}</div></div>
    </article>`;
  }
  function render() {
    const jobs = getJobs();
    $('#metricTotal').textContent = jobs.length;
    $('#metricFresh').textContent = jobs.filter(isFresh).length;
    $('#metricSaved').textContent = jobs.filter(j => local.saved.includes(j.id)).length;
    $('#metricApplied').textContent = jobs.filter(j => hasApplied(j.id)).length;
    $('#navAllCount').textContent = jobs.length;
    const headers = { all: ['Worth a closer look.','Search, shortlist, and track every opening in one place.'], new: ['Just added to Scout.','Discovered in the last seven days, not necessarily published this week.'], saved: ['Your shortlist.','The listings you bookmarked for later.'], applied: ['Your application pipeline.','Keep track of submissions, interviews, and next steps.'] };
    $('#boardTitle').innerHTML = escaped(headers[view][0].slice(0,-1)) + '<span>.</span>';
    $('#boardSubtitle').textContent = headers[view][1];
    $$('.tab, .nav-link').forEach(b => { const on = b.dataset.view === view; b.classList.toggle('active',on); b.classList.toggle('selected',on); });
    const shown = activeJobs();
    $('#resultCount').textContent = `${shown.length} result${shown.length === 1 ? '' : 's'}`;
    $('#results').innerHTML = shown.length ? shown.map(renderCard).join('') : `<div class="empty-state"><div class="empty-icon">⌕</div><h3>No opportunities match right now.</h3><p>Try a broader location or category, or add an opportunity you found through Handshake or your network.</p></div>`;
    const days = daysSince(feed.updated_at);
    const stamp = feed.updated_at ? `${dateFormat(feed.updated_at)} · ${feed.update_type === 'initial_curated_snapshot' ? 'Launch snapshot' : 'Automated feed scan'}` : 'No scan timestamp';
    $('#lastSync').textContent = `Last feed update: ${stamp}`;
    $('#feedHealth').textContent = days > 9 ? 'Update is overdue. Enable/check the scheduled workflow; some leads may be stale.' : 'Eligibility and active hiring must be checked on the employer application.';
    renderDigest();
  }
  function renderDigest() {
    const addedIds = new Set(Array.isArray(digest.added_ids) ? digest.added_ids : []);
    const fresh = getJobs().filter(j => addedIds.has(j.id)).sort((a,b)=>score(b)-score(a)).slice(0, 4);
    if (fresh.length) {
      $('#digestDescription').textContent = `Last scan: ${dateFormat(digest.updated_at)}. These roles were newly added by the automated scanner.`;
      $('#digestList').innerHTML = fresh.map(j => `<div class="digest-item"><div><strong>${escaped(j.company)}</strong> · ${escaped(j.title)}<div><small>${escaped(j.location || '')}</small></div></div><a href="${escaped(secureUrl(j.url))}" target="_blank" rel="noopener noreferrer">↗</a></div>`).join('');
    } else {
      $('#digestDescription').textContent = digest.message || 'No new postings in the most recent scan.';
      $('#digestList').innerHTML = `<div class="digest-item"><strong>No confirmed new feed additions yet</strong><small>Check the full board above</small></div>`;
    }
  }
  function setView(next) { view = next; render(); if (next !== 'all') $('#board').scrollIntoView({behavior:'smooth',block:'start'}); }
  $$('.tab, .nav-link').forEach(b => b.addEventListener('click',()=>setView(b.dataset.view)));
  ['search','area','category','eligibility','sort'].forEach(id => $('#'+id).addEventListener(id==='search'?'input':'change',render));
  $('#showAll').addEventListener('click',()=>setView('all'));
  $('#results').addEventListener('click',e => {
    const btn = e.target.closest('button[data-action]'); if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'save') { local.saved = local.saved.includes(id) ? local.saved.filter(s => s !== id) : [...local.saved,id]; persist(); render(); }
    if (btn.dataset.action === 'notes') { notesId = id; const j = getJobs().find(j => j.id === id); $('#notesTitle').textContent = `${j?.company || 'Listing'} notes`; $('#notesText').value = local.notes[id] || ''; $('#notesDialog').showModal(); }
    if (btn.dataset.action === 'delete' && confirm('Delete this custom listing?')) { local.custom = local.custom.filter(j => j.id !== id); local.saved = local.saved.filter(s => s !== id); delete local.tracking[id]; delete local.notes[id]; persist(); render(); }
  });
  $('#results').addEventListener('change',e => { const sel=e.target.closest('select[data-status-id]'); if(!sel)return; if(sel.value==='none') delete local.tracking[sel.dataset.statusId]; else local.tracking[sel.dataset.statusId]=sel.value; persist(); render(); });
  const showAdd = () => $('#jobDialog').showModal();
  $('#addManual').addEventListener('click',showAdd); $('#addManualHero').addEventListener('click',showAdd);
  $('#closeDialog').addEventListener('click',()=>$('#jobDialog').close()); $('#cancelDialog').addEventListener('click',()=>$('#jobDialog').close());
  $('#jobForm').addEventListener('submit',e => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.target).entries()); const url = secureUrl(v.url); if(!url){alert('Please enter a valid HTTP or HTTPS link.');return;} const location=v.location.trim(); const j={id:'custom-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),company:v.company.trim(),title:v.title.trim(),location,area:/(athens|watkinsville|bogart)/i.test(location)?'Athens':/(atlanta|alpharetta|marietta|roswell|brookhaven|sandy springs)/i.test(location)?'Atlanta':/remote/i.test(location)?'Remote':'Nationwide',category:v.category,season:'Not specified',eligibility:'unknown',eligibility_note:'Personal listing — verify role eligibility on the employer website',url,source:'Manually added',status:'manual',first_seen:today(),deadline:v.deadline||null};local.custom.unshift(j);persist();e.target.reset();$('#jobDialog').close();setView('all'); });
  $('#closeNotes').addEventListener('click',()=>$('#notesDialog').close()); $('#cancelNotes').addEventListener('click',()=>$('#notesDialog').close());
  $('#saveNotes').addEventListener('click',()=>{ if(notesId){local.notes[notesId]=$('#notesText').value.trim();persist();}$('#notesDialog').close(); });
  $('#exportCsv').addEventListener('click',()=>{
    const headings=['Company','Title','Location','Field','Season','Eligibility','Application Status','URL','Deadline','Notes','Source'];
    const rows=getJobs().map(j=>[j.company,j.title,j.location,j.category,j.season,j.eligibility,local.tracking[j.id]||'not started',j.url,j.deadline||'',local.notes[j.id]||'',j.source]);
    const cell=s=>{let v=String(s??''); if (/^[=+@\-\t\r]/.test(v))v="'"+v; return '"'+v.replace(/"/g,'""')+'"';};
    const csv='\uFEFF'+[headings,...rows].map(r=>r.map(cell).join(',')).join('\r\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`scout-internships-${today()}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),500);
  });
  render();
  if (location.protocol.startsWith('http')) {
    Promise.allSettled([fetch('./data/listings.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}),fetch('./data/latest_digest.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();})]).then(([a,b])=>{if(a.status==='fulfilled' && Array.isArray(a.value.jobs))feed=a.value;if(b.status==='fulfilled')digest=b.value;render();});
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
